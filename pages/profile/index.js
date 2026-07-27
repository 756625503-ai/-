const storage = require('../../utils/storage')

function decorateProfile(profile) {
  return Object.assign({}, profile, {
    displayName: storage.getProfileDisplayName(profile),
    locationText: storage.getProfileLocation(profile),
    birthText: storage.getProfileBirthText(profile),
    genderIcon: profile.gender === '男' ? '♂' : '♀'
  })
}

Page({
  data: {
    profiles: [],
    activeProfileId: ''
  },

  onShow() {
    this.loadProfiles()
  },

  loadProfiles() {
    const profiles = storage.getProfiles().map(decorateProfile)

    this.setData({
      profiles: profiles,
      activeProfileId: storage.getSelectedProfileId()
    })
  },

  selectProfile(event) {
    storage.setSelectedProfileId(event.currentTarget.dataset.id)
    this.loadProfiles()
  },

  openProfile(event) {
    const id = event.currentTarget.dataset.id
    storage.setSelectedProfileId(id)
    wx.navigateTo({
      url: '/pages/profile-detail/index?id=' + id
    })
  },

  addProfile() {
    const profile = storage.addProfile('家人')
    wx.navigateTo({
      url: '/pages/profile-detail/index?id=' + profile.id + '&isNew=1'
    })
  }
})
