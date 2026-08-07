const storage = require('../../utils/storage')
const ocr = require('../../utils/ocr')
const MAX_ATTACHMENTS = 100

function getToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function getDefaultRecord() {
  return {
    id: '',
    type: '门诊',
    visitDate: getToday(),
    title: '',
    hospital: '',
    department: '',
    doctor: '',
    summary: '',
    diagnosis: '',
    medicines: '',
    advice: '',
    files: []
  }
}

function chunkTypeRows(items, rowColumns) {
  const rows = []
  for (let index = 0; index < items.length; index += rowColumns) {
    rows.push({
      key: 'row-' + index,
      items: items.slice(index, index + rowColumns)
    })
  }
  return rows
}

function createTypeGroup(label, themeClass, items, rowColumns) {
  return {
    label: label,
    themeClass: themeClass,
    items: items,
    rowColumns: rowColumns,
    rows: chunkTypeRows(items, rowColumns)
  }
}

function getTypeGroups() {
  return [
    createTypeGroup(
      '医疗记录',
      'type-primary',
      [
        { value: '门诊', icon: '诊', hint: '看诊复诊' },
        { value: '体检', icon: '检', hint: '年度筛查' },
        { value: '检查', icon: '查', hint: '影像化验' },
        { value: '住院', icon: '院', hint: '入院出院' },
        { value: '其他', icon: '记', hint: '补充记录' }
      ],
      2
    ),
    createTypeGroup(
      '用药 / 不适',
      'type-health',
      [
        { value: '用药情况', icon: '药', hint: '药名剂量' },
        { value: '身体不适', icon: '感', hint: '日常症状' }
      ],
      2
    )
  ]
}

function getTypeOptions() {
  return getTypeGroups().reduce(function (options, group) {
    return options.concat(group.items.map(function (item) {
      return item.value
    }))
  }, [])
}

function getTypeThemeClass(type) {
  return ['处方', '用药情况', '身体不适'].indexOf(type) >= 0 ? 'pill-health' : 'pill-primary'
}

function normalizeType(type) {
  if (type === '检查报告') return '检查'
  if (type === '处方') return '用药情况'
  return type || '门诊'
}

function saveTempFile(tempFilePath) {
  return new Promise(function (resolve) {
    wx.saveFile({
      tempFilePath: tempFilePath,
      success: function (res) {
        resolve(res.savedFilePath)
      },
      fail: function () {
        resolve(tempFilePath)
      }
    })
  })
}

function getDefaultAttachmentTitle(index) {
  return 'No.' + (index + 1)
}

function getOcrStatusText(file) {
  if (file.ocrStatus === 'done') return '已识别'
  if (file.ocrStatus === 'recognizing') return '识别中'
  if (file.ocrStatus === 'failed') return '识别失败'
  return file.ocrText ? '已识别' : '未识别'
}

function getOcrPreview(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  return value.length > 72 ? value.slice(0, 72) + '...' : value
}

function normalizeAttachment(file, index, fallbackDate) {
  const ocrStatus = file.ocrStatus
  return Object.assign({}, file, {
    title: file.title || getDefaultAttachmentTitle(index),
    date: file.date || file.uploadDate || fallbackDate || getToday(),
    ocrText: file.ocrText || '',
    ocrStatus: ocrStatus || (file.ocrText ? 'done' : ''),
    ocrStatusText: getOcrStatusText(Object.assign({}, file, { ocrStatus: ocrStatus })),
    ocrPreview: getOcrPreview(file.ocrText),
    canRecognize: ocr.canRecognizeAttachment(file)
  })
}

function hasRecordContent(record) {
  return Boolean(
    record.title ||
    record.hospital ||
    record.department ||
    record.doctor ||
    record.summary ||
    record.diagnosis ||
    record.medicines ||
    record.advice ||
    (record.files || []).length
  )
}

Page({
  data: {
    isEditing: false,
    profiles: [],
    profileNames: [],
    profileIndex: 0,
    activeProfileName: '',
    typeGroups: getTypeGroups(),
    typeOptions: getTypeOptions(),
    typeIndex: 0,
    typeThemeClass: getTypeThemeClass('门诊'),
    maxAttachments: MAX_ATTACHMENTS,
    record: getDefaultRecord()
  },

  onLoad(options) {
    const profiles = storage.getProfiles()
    const activeProfileId = storage.getSelectedProfileId()
    const profileNames = profiles.map(function (profile) {
      return storage.getProfileDisplayName(profile)
    })
    const activeProfileName = storage.getProfileDisplayName(storage.getProfileById(activeProfileId))

    this.setData({
      profiles: profiles,
      profileNames: profileNames,
      profileIndex: Math.max(0, profiles.findIndex(function (profile) {
        return profile.id === activeProfileId
      })),
      activeProfileName: activeProfileName,
      'record.profileId': activeProfileId,
      'record.profileName': activeProfileName
    })

    if (options.id) {
      const record = storage.getRecordById(options.id)
      if (record) {
        const normalizedRecord = Object.assign({}, record, {
          type: normalizeType(record.type),
          files: (record.files || []).map(function (file, index) {
            return normalizeAttachment(file, index, record.visitDate)
          })
        })
        const typeIndex = Math.max(0, this.data.typeOptions.indexOf(normalizedRecord.type))
        const profileIndex = Math.max(0, profiles.findIndex(function (profile) {
          return profile.id === record.profileId
        }))
        const profile = profiles[profileIndex] || profiles[0]
        this.setData({
          isEditing: true,
          typeIndex: typeIndex,
          typeThemeClass: getTypeThemeClass(normalizedRecord.type),
          profileIndex: profileIndex,
          activeProfileName: storage.getProfileDisplayName(profile),
          record: Object.assign(getDefaultRecord(), normalizedRecord)
        })
      }
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      ['record.' + field]: event.detail.value
    }, () => {
      this.persistRecordSilently()
    })
  },

  onTypeChange(event) {
    const index = Number(event.detail.value)
    const type = this.data.typeOptions[index]
    this.setData({
      typeIndex: index,
      typeThemeClass: getTypeThemeClass(type),
      'record.type': type
    }, () => {
      this.persistRecordSilently()
    })
  },

  onTypeTap(event) {
    const type = event.currentTarget.dataset.type
    const typeIndex = Math.max(0, this.data.typeOptions.indexOf(type))
    this.setData({
      typeIndex: typeIndex,
      typeThemeClass: getTypeThemeClass(type),
      'record.type': type
    }, () => {
      this.persistRecordSilently()
    })
  },

  onProfileChange(event) {
    const index = Number(event.detail.value)
    const profile = this.data.profiles[index]
    if (!profile) return

    this.setData({
      profileIndex: index,
      activeProfileName: storage.getProfileDisplayName(profile),
      'record.profileId': profile.id,
      'record.profileName': storage.getProfileDisplayName(profile)
    }, () => {
      this.persistRecordSilently()
    })
  },

  onDateChange(event) {
    this.setData({
      'record.visitDate': event.detail.value
    }, () => {
      this.persistRecordSilently()
    })
  },

  onAttachmentTitleInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const files = (this.data.record.files || []).slice()
    if (!files[index]) return

    files[index] = Object.assign({}, files[index], {
      title: event.detail.value
    })

    this.setData({
      'record.files': files
    }, () => {
      this.persistRecordSilently()
    })
  },

  onAttachmentDateChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const files = (this.data.record.files || []).slice()
    if (!files[index]) return

    files[index] = Object.assign({}, files[index], {
      date: event.detail.value
    })

    this.setData({
      'record.files': files
    }, () => {
      this.persistRecordSilently()
    })
  },

  onAttachmentOcrInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const files = (this.data.record.files || []).slice()
    if (!files[index]) return

    files[index] = normalizeAttachment(Object.assign({}, files[index], {
      ocrText: event.detail.value,
      ocrStatus: event.detail.value ? 'done' : ''
    }), index, this.data.record.visitDate)

    this.setData({
      'record.files': files
    }, () => {
      this.persistRecordSilently()
    })
  },

  recognizeAttachment(event) {
    const index = Number(event.currentTarget.dataset.index)
    const files = (this.data.record.files || []).slice()
    const file = files[index]
    if (!file) return

    if (!ocr.canRecognizeAttachment(file)) {
      wx.showToast({
        title: '当前只支持图片识别',
        icon: 'none'
      })
      return
    }

    files[index] = normalizeAttachment(Object.assign({}, file, {
      ocrStatus: 'recognizing'
    }), index, this.data.record.visitDate)
    this.setData({
      'record.files': files
    }, () => {
      this.persistRecordSilently()
    })

    wx.showLoading({
      title: '识别中'
    })

    ocr.recognizeAttachment(file).then((result) => {
      const latestFiles = (this.data.record.files || []).slice()
      const latestFile = latestFiles[index]
      if (!latestFile) return

      latestFiles[index] = normalizeAttachment(Object.assign({}, latestFile, {
        ocrText: result.text || '',
        ocrStatus: result.text ? 'done' : 'failed',
        cloudFileID: result.cloudFileID || latestFile.cloudFileID || ''
      }), index, this.data.record.visitDate)
      this.setData({
        'record.files': latestFiles
      }, () => {
        this.persistRecordSilently()
      })

      wx.showToast({
        title: result.text ? '已识别' : '未识别到文字',
        icon: 'none'
      })
    }).catch((error) => {
      const latestFiles = (this.data.record.files || []).slice()
      if (latestFiles[index]) {
        latestFiles[index] = normalizeAttachment(Object.assign({}, latestFiles[index], {
          ocrStatus: 'failed'
        }), index, this.data.record.visitDate)
        this.setData({
          'record.files': latestFiles
        }, () => {
          this.persistRecordSilently()
        })
      }

      wx.showToast({
        title: error && error.message ? error.message : '识别失败',
        icon: 'none'
      })
    }).finally(function () {
      wx.hideLoading()
    })
  },

  chooseAttachment() {
    if ((this.data.record.files || []).length >= MAX_ATTACHMENTS) {
      wx.showToast({
        title: '最多上传100个',
        icon: 'none'
      })
      return
    }

    wx.showActionSheet({
      itemList: ['图片', '视频', '微信文件'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseImage()
        } else if (res.tapIndex === 1) {
          this.chooseVideo()
        } else {
          this.chooseFile()
        }
      }
    })
  },

  chooseImage() {
    const remaining = MAX_ATTACHMENTS - (this.data.record.files || []).length
    // chooseImage works in older base libraries and test environments where chooseMedia is unavailable.
    wx.chooseImage({
      count: Math.min(9, remaining),
      sourceType: ['album', 'camera'],
      success: (res) => {
        Promise.all(res.tempFilePaths.map(function (tempFilePath, index) {
          return saveTempFile(tempFilePath).then(function (savedPath) {
            return {
              name: '报告图片-' + (index + 1) + '.jpg',
              path: savedPath,
              type: 'image'
            }
          })
        })).then((files) => {
          this.appendFiles(files)
        })
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.indexOf('cancel') >= 0) return
        wx.showToast({
          title: '图片选择不可用，请检查小程序权限',
          icon: 'none'
        })
      }
    })
  },

  chooseFile() {
    const remaining = MAX_ATTACHMENTS - (this.data.record.files || []).length
    wx.chooseMessageFile({
      count: Math.min(9, remaining),
      type: 'file',
      success: (res) => {
        Promise.all(res.tempFiles.map(function (file) {
          return saveTempFile(file.path).then(function (savedPath) {
            return {
              name: file.name,
              path: savedPath,
              type: 'file'
            }
          })
        })).then((files) => {
          this.appendFiles(files)
        })
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.indexOf('cancel') >= 0) return
        wx.showToast({
          title: '当前环境暂不支持选择微信文件',
          icon: 'none'
        })
      }
    })
  },

  chooseVideo() {
    const remaining = MAX_ATTACHMENTS - (this.data.record.files || []).length
    // chooseVideo avoids the chooseMedia component check on test accounts.
    wx.chooseVideo({
      sourceType: ['album', 'camera'],
      success: (res) => {
        saveTempFile(res.tempFilePath).then((savedPath) => {
          this.appendFiles([{
            name: '胶片视频-' + ((this.data.record.files || []).length + 1) + '.mp4',
            path: savedPath,
            duration: res.duration || 0,
            type: 'video'
          }])
        })
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.indexOf('cancel') >= 0) return
        wx.showToast({
          title: '视频选择不可用，请检查小程序权限',
          icon: 'none'
        })
      }
    })
  },

  appendFiles(files) {
    const existingFiles = this.data.record.files || []
    const today = getToday()
    const filesWithMeta = files.map(function (file, index) {
      return normalizeAttachment(file, existingFiles.length + index, today)
    })
    const nextFiles = existingFiles.concat(filesWithMeta).slice(0, MAX_ATTACHMENTS)
    this.setData({
      'record.files': nextFiles
    }, () => {
      this.persistRecordSilently()
    })
  },

  removeAttachment(event) {
    const index = Number(event.currentTarget.dataset.index)
    wx.showModal({
      title: '删除附件',
      content: '删除后需要重新上传。',
      confirmText: '删除',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return

        const files = (this.data.record.files || []).filter(function (_, fileIndex) {
          return fileIndex !== index
        })
        this.setData({
          'record.files': files
        }, () => {
          this.persistRecordSilently()
        })
      }
    })
  },

  persistRecordSilently() {
    const record = Object.assign({}, this.data.record)
    if (!hasRecordContent(record)) {
      if (record.id) {
        storage.deleteRecord(record.id)
        this.setData({
          isEditing: false,
          'record.id': '',
          'record.createdAt': '',
          'record.updatedAt': ''
        })
      }
      return null
    }

    const savedRecord = storage.saveRecord(record)
    this.setData({
      isEditing: true,
      'record.id': savedRecord.id,
      'record.profileId': savedRecord.profileId,
      'record.profileName': savedRecord.profileName,
      'record.createdAt': savedRecord.createdAt,
      'record.updatedAt': savedRecord.updatedAt
    })
    return savedRecord
  },

  previewAttachment(event) {
    const index = Number(event.currentTarget.dataset.index)
    const file = (this.data.record.files || [])[index]
    if (!file || !file.path) return

    if (file.type === 'image') {
      const urls = (this.data.record.files || [])
        .filter(function (item) {
          return item.type === 'image'
        })
        .map(function (item) {
          return item.path
        })

      wx.previewImage({
        current: file.path,
        urls: urls
        })
      return
    }

    if (file.type === 'video') {
      wx.previewMedia({
        sources: [{
          url: file.path,
          type: 'video',
          poster: file.poster || ''
        }],
        current: 0,
        fail: function () {
          wx.showToast({
            title: '暂无法预览',
            icon: 'none'
          })
        }
      })
      return
    }

    wx.openDocument({
      filePath: file.path,
      fail: function () {
        wx.showToast({
          title: '暂无法打开',
          icon: 'none'
        })
      }
    })
  },

  saveRecord() {
    const record = Object.assign({}, this.data.record)
    if (!record.title && !record.summary && !record.diagnosis && !record.medicines && !record.advice && !(record.files || []).length) {
      wx.showToast({
        title: '请填写记录内容',
        icon: 'none'
      })
      return
    }

    storage.saveRecord(record)
    wx.showToast({
      title: '已保存',
      icon: 'success'
    })

    setTimeout(function () {
      wx.navigateBack({
        fail: function () {
          wx.switchTab({ url: '/pages/records/index' })
        }
      })
    }, 400)
  },

  deleteRecord() {
    wx.showModal({
      title: '删除记录',
      content: '删除后无法在本机恢复。',
      confirmText: '删除',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return

        storage.deleteRecord(this.data.record.id)
        wx.showToast({
          title: '已删除',
          icon: 'success'
        })

        setTimeout(function () {
          wx.navigateBack({
            fail: function () {
              wx.switchTab({ url: '/pages/records/index' })
            }
          })
        }, 400)
      }
    })
  }
})
