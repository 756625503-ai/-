const storage = require('../../utils/storage')

function getAge(birthday) {
  if (!birthday) return 0
  const birth = new Date(birthday)
  if (Number.isNaN(birth.getTime())) return 0

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDelta = today.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

function buildAdvice(profile) {
  const age = getAge(profile.birthday)
  const hasChronic = Boolean(profile.medicalHistory || profile.longTermMedication)
  const exerciseText = age >= 65
    ? '每周保持 3-5 次低冲击活动，如散步、太极、拉伸；每次 20-40 分钟，量力而行。'
    : '每周建议 3-5 次中等强度运动，每次 30 分钟左右；久坐时每 60 分钟起身活动。'

  return [
    {
      title: '日常饮食',
      text: '三餐规律，增加蔬菜、优质蛋白和全谷物；少盐、少油、少含糖饮料。若有慢性病，请以医生给出的饮食限制为准。'
    },
    {
      title: '运动频率',
      text: exerciseText
    },
    {
      title: '复诊准备',
      text: hasChronic
        ? '复诊前整理近 3 个月检查报告、当前用药和异常症状，把本页档案与记录一起给医生查看。'
        : '就诊前记录最近症状、检查报告和用药情况；体检异常项建议按医生要求复查。'
    }
  ]
}

Page({
  data: {
    profiles: [],
    profile: {},
    activeProfileName: '',
    adviceCards: [],
    genderOptions: ['男', '女', '其他'],
    genderIndex: 0,
    bloodOptions: ['A型', 'B型', 'AB型', 'O型', '不清楚'],
    bloodIndex: 0
  },

  onShow() {
    this.loadProfile()
  },

  loadProfile() {
    const profiles = storage.getProfiles().map(function (profile) {
      return Object.assign({}, profile, {
        displayName: storage.getProfileDisplayName(profile)
      })
    })
    const profile = storage.getActiveProfile()
    const genderIndex = Math.max(0, this.data.genderOptions.indexOf(profile.gender))
    const bloodIndex = Math.max(0, this.data.bloodOptions.indexOf(profile.bloodType))

    this.setData({
      profiles: profiles,
      profile: profile,
      activeProfileName: storage.getProfileDisplayName(profile),
      adviceCards: buildAdvice(profile),
      genderIndex: genderIndex,
      bloodIndex: bloodIndex
    })
  },

  selectProfile(event) {
    storage.setSelectedProfileId(event.currentTarget.dataset.id)
    this.loadProfile()
  },

  addProfile() {
    const profile = storage.addProfile('家人')
    wx.showToast({
      title: '已新增成员',
      icon: 'success'
    })
    this.setData({
      profile: profile
    })
    this.loadProfile()
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    const profile = Object.assign({}, this.data.profile)
    profile[field] = event.detail.value
    this.setData({
      profile: profile,
      activeProfileName: storage.getProfileDisplayName(profile),
      adviceCards: buildAdvice(profile)
    })
  },

  onGenderChange(event) {
    const index = Number(event.detail.value)
    const profile = Object.assign({}, this.data.profile, {
      gender: this.data.genderOptions[index]
    })
    this.setData({
      genderIndex: index,
      profile: profile
    })
  },

  onBirthdayChange(event) {
    const profile = Object.assign({}, this.data.profile, {
      birthday: event.detail.value
    })
    this.setData({
      profile: profile,
      adviceCards: buildAdvice(profile)
    })
  },

  onBloodChange(event) {
    const index = Number(event.detail.value)
    const profile = Object.assign({}, this.data.profile, {
      bloodType: this.data.bloodOptions[index]
    })
    this.setData({
      bloodIndex: index,
      profile: profile
    })
  },

  saveProfile() {
    const profile = storage.saveProfile(this.data.profile)
    this.setData({
      profile: profile,
      activeProfileName: storage.getProfileDisplayName(profile),
      adviceCards: buildAdvice(profile)
    })
    this.loadProfile()
    wx.showToast({
      title: '已保存',
      icon: 'success'
    })
  }
})
