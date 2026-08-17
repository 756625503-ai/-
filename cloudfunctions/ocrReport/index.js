const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

function getErrorMessage(error) {
  const message = String(error && (error.errMsg || error.message || error.Error || error) || '')
  if (message.indexOf("Cannot find module 'pdf-parse'") >= 0) {
    return 'PDF 识别组件尚未部署，请在开发者工具中重新上传并部署 ocrReport 云函数（云端安装依赖）。'
  }
  if (message.indexOf('PDF_FILE_TOO_LARGE') >= 0) return 'PDF 文件超过 20MB，请压缩后重新上传。'
  if (message.indexOf('PDF_PASSWORD_REQUIRED') >= 0) return '这个 PDF 受密码保护，暂时无法识别。'
  if (message.indexOf('TENCENT_OCR_CONFIG_MISSING') >= 0) return '腾讯云 OCR 尚未配置，请在云函数环境变量中填写 TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY。'
  if (message.indexOf('TENCENT_OCR_IMAGE_TOO_LARGE') >= 0) return '图片超过腾讯云 OCR 支持的 5MB 大小，请压缩后重新上传。'
  if (message.indexOf('IMAGE_DOWNLOAD_FAILED') >= 0) return '图片下载失败，请重新上传后再识别。'
  if (message.indexOf('missing_image_url') >= 0) return '没有拿到图片地址，请重新上传照片后再识别。'
  if (message.indexOf('RequestLimitExceeded') >= 0 || message.indexOf('LimitExceeded') >= 0) return '腾讯云 OCR 调用额度或频率已达到限制，请到腾讯云 OCR 控制台查看额度。'
  if (message.indexOf('FailedOperation.UnOpenService') >= 0 || message.indexOf('UnauthorizedOperation') >= 0) return '腾讯云 OCR 服务尚未开通，请先在腾讯云控制台开通 OCR。'
  if (message.indexOf('AuthFailure') >= 0 || message.indexOf('SecretId') >= 0) return '腾讯云 OCR 鉴权失败，请检查云函数中的 SecretId 和 SecretKey。'
  return message || 'OCR 识别失败，请稍后重试'
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding)
}

function getTencentConfig() {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID || ''
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY || ''
  if (!secretId || !secretKey) throw new Error('TENCENT_OCR_CONFIG_MISSING')
  return {
    secretId: secretId,
    secretKey: secretKey,
    region: process.env.TENCENTCLOUD_REGION || 'ap-guangzhou',
    token: process.env.TENCENTCLOUD_SESSION_TOKEN || ''
  }
}

function callTencentOcr(requestData) {
  return new Promise(function (resolve, reject) {
    let config
    try {
      config = getTencentConfig()
    } catch (error) {
      reject(error)
      return
    }

    const host = 'ocr.tencentcloudapi.com'
    const service = 'ocr'
    const version = '2018-11-19'
    const action = 'GeneralAccurateOCR'
    const timestamp = Math.floor(Date.now() / 1000)
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
    const payload = JSON.stringify(requestData)
    const canonicalHeaders = 'content-type:application/json; charset=utf-8\nhost:' + host + '\n'
    const signedHeaders = 'content-type;host'
    const canonicalRequest = 'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + sha256(payload)
    const credentialScope = date + '/' + service + '/tc3_request'
    const stringToSign = 'TC3-HMAC-SHA256\n' + timestamp + '\n' + credentialScope + '\n' + sha256(canonicalRequest)
    const secretDate = hmac('TC3' + config.secretKey, date)
    const secretService = hmac(secretDate, service)
    const secretSigning = hmac(secretService, 'tc3_request')
    const signature = hmac(secretSigning, stringToSign, 'hex')
    const authorization = 'TC3-HMAC-SHA256 Credential=' + config.secretId + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Region': config.region,
      'X-TC-Timestamp': String(timestamp),
      'Authorization': authorization
    }
    if (config.token) headers['X-TC-Token'] = config.token

    const request = https.request({
      hostname: host,
      port: 443,
      path: '/',
      method: 'POST',
      headers: headers,
      timeout: 30000
    }, function (response) {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', function (chunk) {
        body += chunk
      })
      response.on('end', function () {
        let parsed
        try {
          parsed = JSON.parse(body)
        } catch (error) {
          reject(new Error('腾讯云 OCR 返回了无效响应'))
          return
        }
        const errorInfo = parsed.Response && parsed.Response.Error
        if (errorInfo) {
          reject(new Error(String(errorInfo.Code || '') + ': ' + String(errorInfo.Message || '')))
          return
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('腾讯云 OCR 请求失败：HTTP ' + response.statusCode))
          return
        }
        resolve(parsed.Response || {})
      })
    })
    request.on('timeout', function () {
      request.destroy(new Error('腾讯云 OCR 请求超时'))
    })
    request.on('error', reject)
    request.end(payload)
  })
}

async function recognizeImage(fileID, imgUrl) {
  const requestData = {}
  if (fileID) {
    const downloadResult = await cloud.downloadFile({ fileID: fileID })
    const fileContent = downloadResult.fileContent
    if (!fileContent) throw new Error('IMAGE_DOWNLOAD_FAILED')
    if (fileContent.length > 5 * 1024 * 1024) throw new Error('TENCENT_OCR_IMAGE_TOO_LARGE')
    requestData.ImageBase64 = fileContent.toString('base64')
  } else if (imgUrl) {
    requestData.ImageUrl = imgUrl
  } else {
    throw new Error('missing_image_url')
  }

  const result = await callTencentOcr(requestData)
  const detections = result.TextDetections || []
  return {
    text: detections.map(function (item) {
      return item.DetectedText
    }).filter(Boolean).join('\n'),
    raw: {
      provider: 'tencentcloud',
      action: 'GeneralAccurateOCR',
      response: result
    }
  }
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

    if (!imgUrl && !event.fileID) {
      return {
        text: '',
        error: 'missing_image_url',
        errorMessage: '没有拿到图片地址，请重新上传照片后再识别'
      }
    }

    return await recognizeImage(event.fileID || '', imgUrl)
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
