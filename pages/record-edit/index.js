const storage = require('../../utils/storage')
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

function getTypeGroups() {
  return [
    {
      label: '医疗记录',
      themeClass: 'type-green',
      items: ['门诊', '体检', '检查', '住院', '其他']
    },
    {
      label: '用药 / 不适',
      themeClass: 'type-purple',
      items: ['用药情况', '身体不适']
    }
  ]
}

function getTypeOptions() {
  return getTypeGroups().reduce(function (options, group) {
    return options.concat(group.items)
  }, [])
}

function getTypeThemeClass(type) {
  return ['处方', '用药情况', '身体不适'].indexOf(type) >= 0 ? 'pill-purple' : 'pill-green'
}

function normalizeType(type) {
  if (type === '检查报告') return '检查'
  if (type === '处方') return '用药情况'
  return type || '门诊'
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
          type: normalizeType(record.type)
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
    })
  },

  onTypeChange(event) {
    const index = Number(event.detail.value)
    const type = this.data.typeOptions[index]
    this.setData({
      typeIndex: index,
      typeThemeClass: getTypeThemeClass(type),
      'record.type': type
    })
  },

  onTypeTap(event) {
    const type = event.currentTarget.dataset.type
    const typeIndex = Math.max(0, this.data.typeOptions.indexOf(type))
    this.setData({
      typeIndex: typeIndex,
      typeThemeClass: getTypeThemeClass(type),
      'record.type': type
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
    })
  },

  onDateChange(event) {
    this.setData({
      'record.visitDate': event.detail.value
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
    wx.chooseMedia({
      count: Math.min(9, remaining),
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = res.tempFiles.map(function (file, index) {
          return {
            name: '报告图片-' + (index + 1) + '.jpg',
            path: file.tempFilePath,
            type: 'image'
          }
        })
        this.appendFiles(files)
      }
    })
  },

  chooseFile() {
    const remaining = MAX_ATTACHMENTS - (this.data.record.files || []).length
    wx.chooseMessageFile({
      count: Math.min(9, remaining),
      type: 'file',
      success: (res) => {
        const files = res.tempFiles.map(function (file) {
          return {
            name: file.name,
            path: file.path,
            type: 'file'
          }
        })
        this.appendFiles(files)
      }
    })
  },

  chooseVideo() {
    const remaining = MAX_ATTACHMENTS - (this.data.record.files || []).length
    wx.chooseMedia({
      count: Math.min(9, remaining),
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = res.tempFiles.map(function (file, index) {
          return {
            name: '胶片视频-' + (index + 1) + '.mp4',
            path: file.tempFilePath,
            poster: file.thumbTempFilePath || '',
            duration: file.duration || 0,
            type: 'video'
          }
        })
        this.appendFiles(files)
      }
    })
  },

  appendFiles(files) {
    const nextFiles = (this.data.record.files || []).concat(files).slice(0, MAX_ATTACHMENTS)
    this.setData({
      'record.files': nextFiles
    })
  },

  removeAttachment(event) {
    const index = Number(event.currentTarget.dataset.index)
    const files = (this.data.record.files || []).filter(function (_, fileIndex) {
      return fileIndex !== index
    })
    this.setData({
      'record.files': files
    })
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
    if (!record.title && !record.hospital && !record.summary && !record.diagnosis && !record.medicines && !record.advice && !(record.files || []).length) {
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
