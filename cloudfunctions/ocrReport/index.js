const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

function getErrorMessage(error) {
  const message = String(error && (error.errMsg || error.message || error.Error || error) || '')
  if (message.indexOf('permission') >= 0 || message.indexOf('authorize') >= 0 || message.indexOf('access') >= 0 || message.indexOf('48001') >= 0) {
    return 'OCR 没有权限：请在微信开发者工具里重新上传并部署 ocrReport 云函数，并确认云函数包含 config.json 的 ocr.printedText 权限。'
  }
  return message || 'OCR 识别失败，请稍后重试'
}

exports.main = async function (event) {
  try {
    let imgUrl = event.imgUrl || ''

    if (!imgUrl && event.fileID) {
      const tempFileRes = await cloud.getTempFileURL({
        fileList: [event.fileID]
      })
      const file = tempFileRes.fileList && tempFileRes.fileList[0]
      imgUrl = file && file.tempFileURL ? file.tempFileURL : ''
    }

    if (!imgUrl) {
      return {
        text: '',
        error: 'missing_image_url',
        errorMessage: '没有拿到图片地址，请重新上传照片后再识别'
      }
    }

    const result = await cloud.openapi.ocr.printedText({
      imgUrl: imgUrl
    })
    const items = result.items || []

    return {
      text: items.map(function (item) {
        return item.text
      }).filter(Boolean).join('\n'),
      raw: result
    }
  } catch (error) {
    return {
      text: '',
      error: 'ocr_failed',
      errorMessage: getErrorMessage(error),
      raw: {
        errCode: error && error.errCode,
        errMsg: error && error.errMsg,
        message: error && error.message
      }
    }
  }
}
