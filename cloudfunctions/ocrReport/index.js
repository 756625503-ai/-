const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async function (event) {
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
      error: 'missing image url'
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
}
