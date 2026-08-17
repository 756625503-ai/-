const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

function getErrorMessage(error) {
  const message = String(error && (error.errMsg || error.message || error.Error || error) || '')
  const errCode = Number(error && (error.errCode || error.errcode || error.err_code))
  if (message.indexOf("Cannot find module 'pdf-parse'") >= 0) {
    return 'PDF 识别组件尚未部署，请在开发者工具中重新上传并部署 ocrReport 云函数（云端安装依赖）。'
  }
  if (message.indexOf('PDF_FILE_TOO_LARGE') >= 0) return 'PDF 文件超过 20MB，请压缩后重新上传。'
  if (message.indexOf('PDF_PASSWORD_REQUIRED') >= 0) return '这个 PDF 受密码保护，暂时无法识别。'
  if (message.indexOf('permission') >= 0 || message.indexOf('authorize') >= 0 || message.indexOf('access') >= 0 || message.indexOf('48001') >= 0) {
    return 'OCR 没有权限：请确认当前小程序 AppID 已认证并开通 OCR 能力，且云函数包含 ocr.printedText 权限。'
  }
  if (errCode === 101000) return '图片地址无效，请重新上传图片后再识别。'
  if (errCode === 101002) return '图片解码失败或超过 2MB，请换一张更清晰、体积更小的图片。'
  if (errCode === 101003) return 'OCR 调用次数不足或额度已用完。'
  return message || 'OCR 识别失败，请稍后重试'
}

async function extractPdfText(fileID) {
  const downloadResult = await cloud.downloadFile({
    fileID: fileID
  })
  const fileContent = downloadResult.fileContent

  if (!fileContent) throw new Error('PDF_DOWNLOAD_FAILED')
  if (fileContent.length > 20 * 1024 * 1024) throw new Error('PDF_FILE_TOO_LARGE')

  const pdfParse = require('pdf-parse')
  let parsed
  try {
    parsed = await pdfParse(fileContent)
  } catch (error) {
    const message = String(error && error.message || '')
    if (message.toLowerCase().indexOf('password') >= 0) throw new Error('PDF_PASSWORD_REQUIRED')
    throw error
  }

  const text = String(parsed.text || '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    return {
      text: '',
      error: 'pdf_no_text',
      errorMessage: '这个 PDF 没有可提取的文字，可能是扫描件。请将报告页面保存为图片后再识别。',
      raw: {
        pageCount: parsed.numpages || 0
      }
    }
  }

  const maxLength = 50000
  return {
    text: text.slice(0, maxLength),
    raw: {
      pageCount: parsed.numpages || 0,
      truncated: text.length > maxLength
    }
  }
}

exports.main = async function (event) {
  try {
    const isPdf = event.fileType === 'pdf' || /\.pdf$/i.test(event.fileName || '')
    if (isPdf) {
      if (!event.fileID) {
        return {
          text: '',
          error: 'missing_pdf_file',
          errorMessage: '没有拿到 PDF 文件，请重新上传后再识别'
        }
      }
      return await extractPdfText(event.fileID)
    }

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
