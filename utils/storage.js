const PROFILE_KEY = 'health_profile'
const PROFILES_KEY = 'health_profiles'
const SELECTED_PROFILE_KEY = 'health_selected_profile_id'
const RECORDS_KEY = 'health_records'

function getDefaultProfile() {
  return {
    id: '',
    relation: '本人',
    name: '',
    gender: '',
    birthday: '',
    birthTime: '',
    phone: '',
    bloodType: '',
    province: '',
    city: '',
    district: '',
    allergies: '',
    medicalHistory: '',
    familyHistory: '',
    longTermMedication: '',
    emergencyContact: '',
    updatedAt: ''
  }
}

function createId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 100000)
}

function createProfile(overrides) {
  return Object.assign(getDefaultProfile(), overrides || {}, {
    id: overrides && overrides.id ? overrides.id : createId('profile'),
    updatedAt: new Date().toISOString()
  })
}

function ensureData() {
  const profiles = getProfiles()
  const records = wx.getStorageSync(RECORDS_KEY)

  if (!Array.isArray(records)) {
    wx.setStorageSync(RECORDS_KEY, [])
    return
  }

  const defaultProfile = profiles[0]
  const migratedRecords = records.map(function (record) {
    if (record.profileId) return record
    return Object.assign({}, record, {
      profileId: defaultProfile.id,
      profileName: getProfileDisplayName(defaultProfile)
    })
  })

  wx.setStorageSync(RECORDS_KEY, migratedRecords)
}

function getProfiles() {
  const profiles = wx.getStorageSync(PROFILES_KEY)
  if (Array.isArray(profiles) && profiles.length) {
    return profiles.map(function (profile) {
      return Object.assign(getDefaultProfile(), profile)
    })
  }

  const oldProfile = wx.getStorageSync(PROFILE_KEY) || {}
  const firstProfile = createProfile(Object.assign({}, oldProfile, {
    id: oldProfile.id || 'profile_self',
    relation: oldProfile.relation || '本人'
  }))

  wx.setStorageSync(PROFILES_KEY, [firstProfile])
  wx.setStorageSync(SELECTED_PROFILE_KEY, firstProfile.id)
  return [firstProfile]
}

function getSelectedProfileId() {
  const profiles = getProfiles()
  const selectedId = wx.getStorageSync(SELECTED_PROFILE_KEY)
  const exists = profiles.some(function (profile) {
    return profile.id === selectedId
  })

  if (exists) return selectedId

  wx.setStorageSync(SELECTED_PROFILE_KEY, profiles[0].id)
  return profiles[0].id
}

function setSelectedProfileId(id) {
  wx.setStorageSync(SELECTED_PROFILE_KEY, id)
  return id
}

function getProfileById(id) {
  const profiles = getProfiles()
  return profiles.find(function (profile) {
    return profile.id === id
  }) || profiles[0]
}

function getActiveProfile() {
  return getProfileById(getSelectedProfileId())
}

function saveProfile(profile) {
  const profiles = getProfiles()
  const now = new Date().toISOString()
  const nextProfile = Object.assign(getDefaultProfile(), profile, {
    id: profile.id || createId('profile'),
    relation: profile.relation || '家人',
    updatedAt: now
  })

  const index = profiles.findIndex(function (item) {
    return item.id === nextProfile.id
  })

  if (index >= 0) {
    profiles[index] = nextProfile
  } else {
    profiles.push(nextProfile)
  }

  wx.setStorageSync(PROFILES_KEY, profiles)
  wx.setStorageSync(SELECTED_PROFILE_KEY, nextProfile.id)
  return nextProfile
}

function addProfile(relation) {
  const profile = createProfile({
    relation: relation || '家人'
  })
  const profiles = getProfiles().concat(profile)

  wx.setStorageSync(PROFILES_KEY, profiles)
  wx.setStorageSync(SELECTED_PROFILE_KEY, profile.id)
  return profile
}

function getProfileDisplayName(profile) {
  if (!profile) return '未选择成员'
  return profile.name || profile.relation || '未命名成员'
}

function getProfileLocation(profile) {
  if (!profile) return '未填写地区'
  const location = [profile.province, profile.city, profile.district].filter(Boolean).join(' ')
  return location || '未填写地区'
}

function getProfileBirthText(profile) {
  if (!profile || !profile.birthday) return '出生日期未填'
  return profile.birthday + ' ' + (profile.birthTime || '00:00')
}

function getRecords(options) {
  const profileId = options && options.profileId
  const records = wx.getStorageSync(RECORDS_KEY)
  if (!Array.isArray(records)) return []

  return records.filter(function (record) {
    return !profileId || record.profileId === profileId
  }).sort(function (a, b) {
    const aTime = new Date(a.visitDate || a.createdAt || 0).getTime()
    const bTime = new Date(b.visitDate || b.createdAt || 0).getTime()
    return bTime - aTime
  })
}

function getRecordById(id) {
  return getRecords().find(function (record) {
    return record.id === id
  })
}

function saveRecord(record) {
  const records = getRecords()
  const now = new Date().toISOString()
  const profile = getProfileById(record.profileId || getSelectedProfileId())
  const nextRecord = Object.assign({}, record, {
    id: record.id || createId('record'),
    profileId: profile.id,
    profileName: getProfileDisplayName(profile),
    updatedAt: now,
    createdAt: record.createdAt || now
  })

  const index = records.findIndex(function (item) {
    return item.id === nextRecord.id
  })

  if (index >= 0) {
    records[index] = nextRecord
  } else {
    records.unshift(nextRecord)
  }

  wx.setStorageSync(RECORDS_KEY, records)
  return nextRecord
}

function deleteRecord(id) {
  const records = getRecords().filter(function (record) {
    return record.id !== id
  })
  wx.setStorageSync(RECORDS_KEY, records)
  return records
}

function formatDate(value) {
  if (!value) return '未填写'
  return String(value).slice(0, 10)
}

function getRecordTitle(record) {
  if (record.title) return record.title
  return (record.type || '健康记录') + ' · ' + formatDate(record.visitDate)
}

function getStats() {
  const profile = getActiveProfile()
  const records = getRecords({ profileId: profile.id })
  const typeMap = {}

  records.forEach(function (record) {
    const type = record.type || '其他'
    typeMap[type] = (typeMap[type] || 0) + 1
  })

  return {
    total: records.length,
    latestDate: records[0] ? formatDate(records[0].visitDate || records[0].createdAt) : '暂无',
    profileReady: Boolean(profile.name || profile.allergies || profile.medicalHistory),
    typeMap: typeMap
  }
}

module.exports = {
  addProfile: addProfile,
  deleteRecord: deleteRecord,
  ensureData: ensureData,
  formatDate: formatDate,
  getActiveProfile: getActiveProfile,
  getProfileById: getProfileById,
  getProfileBirthText: getProfileBirthText,
  getProfileDisplayName: getProfileDisplayName,
  getProfileLocation: getProfileLocation,
  getProfiles: getProfiles,
  getRecordById: getRecordById,
  getRecordTitle: getRecordTitle,
  getRecords: getRecords,
  getSelectedProfileId: getSelectedProfileId,
  getStats: getStats,
  saveProfile: saveProfile,
  saveRecord: saveRecord,
  setSelectedProfileId: setSelectedProfileId
}
