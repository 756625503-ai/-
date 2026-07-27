const storage = require('../../utils/storage')

function valueOrEmpty(value) {
  const text = String(value || '').trim()
  return text || '未填写'
}

Page({
  data: {
    profile: {},
    recentRecords: []
  },

  onShow() {
    const profile = storage.getProfile()
    const recentRecords = storage.getRecords().slice(0, 8).map(function (record) {
      return Object.assign({}, record, {
        displayDate: storage.formatDate(record.visitDate || record.createdAt),
        displayTitle: storage.getRecordTitle(record)
      })
    })

    this.setData({
      profile: profile,
      recentRecords: recentRecords
    })
  },

  copySummary() {
    const profile = this.data.profile
    const lines = [
      '姓名：' + valueOrEmpty(profile.name),
      '性别：' + valueOrEmpty(profile.gender),
      '出生日期：' + valueOrEmpty(profile.birthday),
      '血型：' + valueOrEmpty(profile.bloodType),
      '过敏史：' + valueOrEmpty(profile.allergies),
      '既往病史：' + valueOrEmpty(profile.medicalHistory),
      '长期用药：' + valueOrEmpty(profile.longTermMedication),
      '家族病史：' + valueOrEmpty(profile.familyHistory),
      '紧急联系人：' + valueOrEmpty(profile.emergencyContact),
      '',
      '近期记录：'
    ]

    this.data.recentRecords.forEach(function (record, index) {
      lines.push(
        index + 1 + '. ' + record.displayDate + ' ' + record.type + ' ' + record.displayTitle,
        '医院科室：' + valueOrEmpty((record.hospital || '') + ' ' + (record.department || '')),
        '诊断：' + valueOrEmpty(record.diagnosis),
        '用药：' + valueOrEmpty(record.medicines),
        '建议：' + valueOrEmpty(record.advice)
      )
    })

    wx.setClipboardData({
      data: lines.join('\n'),
      success: function () {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        })
      }
    })
  }
})
