const storage = require('../../utils/storage')

Page({
  data: {
    records: [],
    filteredRecords: [],
    keyword: '',
    activeType: '全部',
    filterOptions: ['全部', '门诊', '体检', '检查报告', '处方', '住院', '其他']
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    const records = storage.getRecords().map(function (record) {
      return Object.assign({}, record, {
        displayDate: storage.formatDate(record.visitDate || record.createdAt),
        displayTitle: storage.getRecordTitle(record),
        files: record.files || []
      })
    })

    this.setData({ records: records })
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
