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
    activeProfileId: '',
    revealedDeleteId: ''
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

  blockProfileOpen(id) {
    if (this.blockOpenTimer) clearTimeout(this.blockOpenTimer)

    this.blockNextOpenId = id
    this.blockOpenTimer = setTimeout(() => {
      if (this.blockNextOpenId === id) this.blockNextOpenId = ''
    }, 600)
  },

  onProfileTouchStart(event) {
    const touch = event.touches && event.touches[0]
    if (!touch) return

    this.profileTouch = {
      id: event.currentTarget.dataset.id,
      x: touch.clientX,
      y: touch.clientY
    }
  },

  onProfileTouchEnd(event) {
    const touch = event.changedTouches && event.changedTouches[0]
    const start = this.profileTouch
    this.profileTouch = null

    if (!touch || !start) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) return

    this.blockProfileOpen(start.id)
    this.setData({
      revealedDeleteId: deltaX < 0 ? start.id : ''
    })
  },

  onProfileLongPress(event) {
    const id = event.currentTarget.dataset.id
    this.blockProfileOpen(id)
    this.setData({
      revealedDeleteId: id
    })

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' })
    }
  },

  selectProfile(event) {
    storage.setSelectedProfileId(event.currentTarget.dataset.id)
    this.loadProfiles()
  },

  openProfile(event) {
    const id = event.currentTarget.dataset.id

    if (this.blockNextOpenId === id) {
      this.blockNextOpenId = ''
      return
    }

    if (this.data.revealedDeleteId) {
      this.setData({ revealedDeleteId: '' })
      return
    }

    storage.setSelectedProfileId(id)
    wx.navigateTo({
      url: '/pages/profile-detail/index?id=' + id
    })
  },

  deleteProfile(event) {
    const id = event.currentTarget.dataset.id
    const name = event.currentTarget.dataset.name || '该成员'

    if (this.data.profiles.length <= 1) {
      wx.showToast({
        title: '至少保留一个档案',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '删除档案',
      content: '删除“' + name + '”后，该成员的健康记录也会一并删除。',
      confirmText: '删除',
      confirmColor: '#b42318',
      success: (result) => {
        if (!result.confirm) return

        const deleteResult = storage.deleteProfile(id)
        if (!deleteResult.deleted) {
          wx.showToast({
            title: deleteResult.reason === 'last-profile' ? '至少保留一个档案' : '档案不存在',
            icon: 'none'
          })
          return
        }

        this.setData({ revealedDeleteId: '' })
        this.loadProfiles()
        wx.showToast({
          title: '档案已删除',
          icon: 'success'
        })
      }
    })
  },

  addProfile() {
    const profile = storage.addProfile('家人')
    wx.navigateTo({
      url: '/pages/profile-detail/index?id=' + profile.id + '&isNew=1'
    })
  }
})
