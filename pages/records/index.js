const storage = require('../../utils/storage')
const reportMetrics = require('../../utils/report-metrics')

function getTimelineTitle(record) {
  if (record.title) return record.title
  if (record.type === '门诊') return '门诊记录'
  if (record.type === '检查报告' || record.type === '检查') return '检查'
  if (record.type === '处方' || record.type === '用药情况') return '用药情况'
  if (record.type === '身体不适') return '身体不适'
  return record.type || '看诊记录'
}

function getTimelineThemeClass(record) {
  const purpleTypes = ['处方', '用药情况', '身体不适']
  return purpleTypes.indexOf(record.type) >= 0 ? 'event-purple' : 'event-green'
}

function getTimelineMeta(record) {
  if (record.type === '处方' || record.type === '用药情况') {
    return record.medicines || record.summary || record.advice || '未填写用药情况'
  }

  if (record.type === '身体不适') {
    return record.summary || record.diagnosis || record.advice || '未填写不适描述'
  }

  if (record.summary || record.diagnosis || record.advice) {
    return record.summary || record.diagnosis || record.advice
  }

  const files = Array.isArray(record.files) ? record.files : []
  const ocrCount = files.filter(function (file) {
    return Boolean(file.ocrText)
  }).length

  if (ocrCount) return '已识别' + ocrCount + '个附件'
  if (files.length) return files.length + '个附件待识别'
  return '未填写记录内容'
}

function buildSearchText(record) {
  const files = Array.isArray(record.files) ? record.files : []
  return [
    record.type,
    record.title,
    record.displayTitle,
    record.visitDate,
    record.displayDate,
    record.createdAt,
    record.updatedAt,
    record.hospital,
    record.department,
    record.doctor,
    record.summary,
    record.diagnosis,
    record.medicines,
    record.advice,
    record.timelineTitle,
    record.timelineMeta,
    reportMetrics.getOcrText(record)
  ]
    .concat(files.reduce(function (items, file) {
      return items.concat([
        file.title,
        file.name,
        file.date
      ])
    }, []))
    .join(' ')
    .toLowerCase()
}

function getAvatarText(name) {
  const text = String(name || '').trim()
  return text ? text.slice(0, 1) : '健'
}

Page({
  data: {
    profiles: [],
    activeProfileId: '',
    activeProfileName: '',
    activeProfileAvatar: '健',
    records: [],
    filteredRecords: [],
    keyword: '',
    activeType: '全部',
    filterOptions: ['全部', '门诊', '体检', '检查', '用药情况', '身体不适', '住院', '其他']
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    const profiles = storage.getProfiles().map(function (profile) {
      return Object.assign({}, profile, {
        displayName: storage.getProfileDisplayName(profile)
      })
    })
    const activeProfileId = storage.getSelectedProfileId()
    const activeProfile = storage.getProfileById(activeProfileId)
    const records = storage.getRecords({ profileId: activeProfileId }).map(function (record) {
      return Object.assign({}, record, {
        displayDate: storage.formatDate(record.visitDate || record.createdAt),
        displayTitle: storage.getRecordTitle(record),
        timelineTitle: getTimelineTitle(record),
        timelineMeta: getTimelineMeta(record),
        themeClass: getTimelineThemeClass(record),
        files: record.files || []
      })
    })

    this.setData({
      profiles: profiles,
      activeProfileId: activeProfileId,
      activeProfileName: storage.getProfileDisplayName(activeProfile),
      activeProfileAvatar: getAvatarText(storage.getProfileDisplayName(activeProfile)),
      records: records
    })
    this.applyFilters()
  },

  onSearch(event) {
    this.setData({ keyword: event.detail.value })
    this.applyFilters()
  },

  changeFilter(event) {
    this.setData({
      activeType: event.currentTarget.dataset.type
    })
    this.applyFilters()
  },

  changeProfile(event) {
    storage.setSelectedProfileId(event.currentTarget.dataset.id)
    this.loadRecords()
  },

  applyFilters() {
    const keyword = String(this.data.keyword || '').trim().toLowerCase()
    const activeType = this.data.activeType
    const matchedRecords = this.data.records.filter(function (record) {
      const typeMatched = activeType === '全部' || record.type === activeType
      const text = buildSearchText(record)

      return typeMatched && (!keyword || text.indexOf(keyword) >= 0)
    })
    const filteredRecords = matchedRecords.map(function (record, index) {
      return Object.assign({}, record, {
        isLastTimelineRecord: index === matchedRecords.length - 1
      })
    })

    this.setData({
      filteredRecords: filteredRecords
    })
  },

  goAdd() {
    wx.navigateTo({
      url: '/pages/record-edit/index'
    })
  },

  goCompare() {
    wx.navigateTo({
      url: '/pages/report-compare/index'
    })
  },

  openRecord(event) {
    wx.navigateTo({
      url: '/pages/record-edit/index?id=' + event.currentTarget.dataset.id
    })
  }
})
