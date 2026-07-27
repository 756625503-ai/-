const storage = require('../../utils/storage')

Page({
  data: {
    stats: {
      total: 0,
      latestDate: '暂无',
      profileReady: false
    },
    recentRecords: []
  },

  onShow() {
    const recentRecords = storage.getRecords().slice(0, 3).map(function (record) {
      return Object.assign({}, record, {
        displayDate: storage.formatDate(record.visitDate || record.createdAt),
        displayTitle: storage.getRecordTitle(record)
      })
    })

    this.setData({
      stats: storage.getStats(),
      recentRecords: recentRecords
    })
  },

  goAdd() {
    wx.navigateTo({
      url: '/pages/record-edit/index'
    })
  },

  goDoctor() {
    wx.switchTab({
      url: '/pages/doctor-view/index'
    })
  },

  goProfile() {
    wx.switchTab({
      url: '/pages/profile/index'
    })
  },

  goRecords() {
    wx.switchTab({
      url: '/pages/records/index'
    })
  },

  openRecord(event) {
    wx.navigateTo({
      url: '/pages/record-edit/index?id=' + event.currentTarget.dataset.id
    })
  }
})
