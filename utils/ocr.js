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

function recognizeAttachment(file) {
  return new Promise(function (resolve, reject) {
    if (!canRecognizeAttachment(file)) {
      reject(new Error('当前只支持图片或 PDF 识别'))
      return
    }

    if (!wx.cloud || !wx.cloud.uploadFile || !wx.cloud.callFunction) {
      reject(new Error('请先开通并配置微信云开发'))
      return
    }

    wx.cloud.uploadFile({
      cloudPath: getCloudPath(file),
      filePath: file.path,
      success: function (uploadRes) {
        wx.cloud.callFunction({
          name: 'ocrReport',
          data: {
            fileID: uploadRes.fileID,
            fileType: isPdfAttachment(file) ? 'pdf' : 'image',
            fileName: file.name || ''
          },
          success: function (res) {
            const result = res.result || {}
            if (result.error) {
              reject(new Error(result.errorMessage || '识别失败'))
              return
            }

            resolve({
              text: result.text || '',
              raw: result.raw || null,
              cloudFileID: uploadRes.fileID
            })
          },
          fail: reject
        })
      },
      fail: reject
    })
  })
}

module.exports = {
  canRecognizeAttachment: canRecognizeAttachment,
  isPdfAttachment: isPdfAttachment,
  recognizeAttachment: recognizeAttachment
}
