const storage = require('../../utils/storage')

function getTimelineTitle(record) {
  if (record.title) return record.title
  if (record.type === '门诊') return '门诊记录'
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

  return [record.hospital || '未填写医院', record.department || '', record.doctor || ''].join(' ')
}

Page({
  data: {
    profiles: [],
    activeProfileId: '',
    activeProfileName: '',
    records: [],
    filteredRecords: [],
    keyword: '',
    activeType: '全部',
    filterOptions: ['全部', '门诊', '体检', '检查报告', '处方', '用药情况', '身体不适', '住院', '其他']
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
    const filteredRecords = this.data.records.filter(function (record) {
      const typeMatched = activeType === '全部' || record.type === activeType
      const text = [
        record.type,
        record.title,
        record.hospital,
        record.department,
        record.doctor,
        record.summary,
        record.diagnosis,
        record.medicines,
        record.advice
      ].join(' ').toLowerCase()

      return typeMatched && (!keyword || text.indexOf(keyword) >= 0)
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

  openRecord(event) {
    wx.navigateTo({
      url: '/pages/record-edit/index?id=' + event.currentTarget.dataset.id
    })
  }
})
