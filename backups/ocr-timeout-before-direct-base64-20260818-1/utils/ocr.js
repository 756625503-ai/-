function isPdfAttachment(file) {
  if (!file) return false
  const source = String(file.name || file.path || '')
  return file.type === 'pdf' || /\.pdf(?:$|[?#])/i.test(source)
}

function canRecognizeAttachment(file) {
  return Boolean(file && file.path && (file.type === 'image' || isPdfAttachment(file)))
}

function getCloudPath(file) {
  const name = String(file.name || 'report.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')
  return 'ocr-reports/' + Date.now() + '-' + name
}

function getErrorMessage(error) {
  if (!error) return '未知错误'
  let raw = String(error.message || error.errMsg || error.errorMessage || error.errCode || '')
  if (!raw || raw === '[object Object]') {
    try {
      raw = JSON.stringify(error)
    } catch (stringifyError) {
      raw = '未知错误'
    }
  }
  if (raw.indexOf('501000') >= 0) {
    return '云函数调用失败（errcode 501000），请确认小程序与云函数使用同一个云环境，并重新编译后再试'
  }
  if (/timeout|timed out|超时/i.test(raw)) {
    return 'OCR 处理超时，请稍后重试；若持续出现，请检查 ocrReport 云函数超时时间'
  }
  if (/data.*(?:large|limit)|payload.*(?:large|limit)|request.*(?:large|limit)|超过.*(?:大小|限制)/i.test(raw)) {
    return '图片数据过大，请换一张较小的图片后重试'
  }
  if (/FunctionName|function.*not.*found|云函数不存在/i.test(raw)) {
    return '未找到 ocrReport 云函数，请先部署云函数后重试'
  }
  return raw
}

function callOcrFunction(data) {
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: 'ocrReport',
      data: data,
      success: function (res) {
        const result = res && res.result
        if (!result || typeof result !== 'object') {
          reject(new Error('云函数没有返回识别结果，请检查 ocrReport 日志和超时设置'))
          return
        }
        if (result.error) {
          reject(new Error(result.errorMessage || '识别失败'))
          return
        }

        resolve(result)
      },
      fail: function (error) {
        reject(new Error(getErrorMessage(error)))
      }
    })
  })
}

function compressImage(filePath) {
  return new Promise(function (resolve) {
    if (!wx.compressImage) {
      resolve(filePath)
      return
    }

    wx.compressImage({
      src: filePath,
      quality: 55,
      success: function (res) {
        resolve(res.tempFilePath || filePath)
      },
      fail: function () {
        resolve(filePath)
      }
    })
  })
}

function readImageBase64(filePath) {
  return new Promise(function (resolve, reject) {
    if (!wx.getFileSystemManager) {
      reject(new Error('当前基础库不支持读取图片，请升级微信或开发者工具'))
      return
    }

    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: function (res) {
        if (!res.data) {
          reject(new Error('图片内容为空，请重新选择图片'))
          return
        }
        resolve(res.data)
      },
      fail: function (error) {
        reject(new Error(getErrorMessage(error)))
      }
    })
  })
}

function uploadImage(file) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud || !wx.cloud.uploadFile) {
      reject(new Error('当前环境不支持图片上传'))
      return
    }

    wx.cloud.uploadFile({
      cloudPath: getCloudPath(file),
      filePath: file.path,
      success: resolve,
      fail: function (error) {
        reject(new Error(getErrorMessage(error)))
      }
    })
  })
}

function recognizeImageDirectly(file) {
  return uploadImage(file).then(function (uploadRes) {
    return callOcrFunction({
      fileID: uploadRes.fileID,
      fileType: 'image',
      fileName: file.name || ''
    }).then(function (result) {
      return Object.assign({}, result, {
        cloudFileID: uploadRes.fileID || ''
      })
    })
  }, function (uploadError) {
    // 云存储临时不可用时，用压缩图兜底，并限制调用数据大小。
    return compressImage(file.path).then(readImageBase64).then(function (imageBase64) {
      if (imageBase64.length > 900 * 1024) {
        throw new Error('图片较大且云存储上传失败，请检查云开发存储权限后重试')
      }
      return callOcrFunction({
        imageBase64: imageBase64,
        fileType: 'image',
        fileName: file.name || ''
      })
    }).catch(function (fallbackError) {
      const fallbackMessage = getErrorMessage(fallbackError)
      const uploadMessage = getErrorMessage(uploadError)
      throw new Error(fallbackMessage + '；上传错误：' + uploadMessage)
    })
  })
}

function recognizeAttachment(file) {
  return new Promise(function (resolve, reject) {
    if (!canRecognizeAttachment(file)) {
      reject(new Error('当前只支持图片或 PDF 识别'))
      return
    }

    if (!wx.cloud || !wx.cloud.callFunction) {
      reject(new Error('请先开通并配置微信云开发'))
      return
    }

    // 图片直接传给云函数，绕开未配置存储策略时的 fileID 下载限制。
    if (file.type === 'image') {
      recognizeImageDirectly(file).then(function (result) {
        resolve({
          text: result.text || '',
          raw: result.raw || null,
          cloudFileID: result.cloudFileID || ''
        })
      }).catch(reject)
      return
    }

    if (!wx.cloud.uploadFile) {
      reject(new Error('当前环境不支持 PDF 上传，请升级微信或开发者工具'))
      return
    }

    wx.cloud.uploadFile({
      cloudPath: getCloudPath(file),
      filePath: file.path,
      success: function (uploadRes) {
        callOcrFunction({
          fileID: uploadRes.fileID,
          fileType: 'pdf',
          fileName: file.name || ''
        }).then(function (result) {
          resolve({
            text: result.text || '',
            raw: result.raw || null,
            cloudFileID: uploadRes.fileID
          })
        }).catch(reject)
      },
      fail: function (error) {
        reject(new Error(getErrorMessage(error)))
      }
    })
  })
}

module.exports = {
  canRecognizeAttachment: canRecognizeAttachment,
  isPdfAttachment: isPdfAttachment,
  recognizeAttachment: recognizeAttachment
}
