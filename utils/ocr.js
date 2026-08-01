function canRecognizeAttachment(file) {
  return Boolean(file && file.type === 'image' && file.path)
}

function getCloudPath(file) {
  const name = String(file.name || 'report.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')
  return 'ocr-reports/' + Date.now() + '-' + name
}

function recognizeAttachment(file) {
  return new Promise(function (resolve, reject) {
    if (!canRecognizeAttachment(file)) {
      reject(new Error('当前只支持图片识别'))
      return
    }

    if (!wx.cloud || !wx.cloud.uploadFile || !wx.cloud.callFunction) {
      reject(new Error('请先开通并配置微信云开发 OCR'))
      return
    }

    wx.cloud.uploadFile({
      cloudPath: getCloudPath(file),
      filePath: file.path,
      success: function (uploadRes) {
        wx.cloud.callFunction({
          name: 'ocrReport',
          data: {
            fileID: uploadRes.fileID
          },
          success: function (res) {
            const result = res.result || {}
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
  recognizeAttachment: recognizeAttachment
}
