App({
  onLaunch() {
    const records = wx.getStorageSync('health_records')
    const profile = wx.getStorageSync('health_profile')

    if (!Array.isArray(records)) {
      wx.setStorageSync('health_records', [])
    }

    if (!profile) {
      wx.setStorageSync('health_profile', {
        name: '',
        gender: '',
        birthday: '',
        phone: '',
        bloodType: '',
        allergies: '',
        medicalHistory: '',
        familyHistory: '',
        longTermMedication: '',
        emergencyContact: '',
        updatedAt: ''
      })
    }
  }
})
