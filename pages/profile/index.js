const storage = require('../../utils/storage')

Page({
  data: {
    profile: {},
    genderOptions: ['男', '女', '其他'],
    genderIndex: 0,
    bloodOptions: ['A型', 'B型', 'AB型', 'O型', '不清楚'],
    bloodIndex: 0
  },

  onShow() {
    this.loadProfile()
  },

  loadProfile() {
    const profile = storage.getProfile()
    const genderIndex = Math.max(0, this.data.genderOptions.indexOf(profile.gender))
    const bloodIndex = Math.max(0, this.data.bloodOptions.indexOf(profile.bloodType))

    this.setData({
      profile: profile,
      genderIndex: genderIndex,
      bloodIndex: bloodIndex
    })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    const profile = Object.assign({}, this.data.profile)
    profile[field] = event.detail.value
    this.setData({ profile: profile })
  },

  onGenderChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      genderIndex: index,
      'profile.gender': this.data.genderOptions[index]
    })
  },

  onBirthdayChange(event) {
    this.setData({
      'profile.birthday': event.detail.value
    })
  },

  onBloodChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      bloodIndex: index,
      'profile.bloodType': this.data.bloodOptions[index]
    })
  },

  saveProfile() {
    storage.saveProfile(this.data.profile)
    wx.showToast({
      title: '已保存',
      icon: 'success'
    })
  }
})
