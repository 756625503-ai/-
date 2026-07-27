const PROFILE_KEY = 'health_profile'
const RECORDS_KEY = 'health_records'

function getDefaultProfile() {
  return {
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
  }
}

function getProfile() {
  return Object.assign(getDefaultProfile(), wx.getStorageSync(PROFILE_KEY) || {})
}

function saveProfile(profile) {
  const nextProfile = Object.assign(getDefaultProfile(), profile, {
    updatedAt: new Date().toISOString()
  })
  wx.setStorageSync(PROFILE_KEY, nextProfile)
  return nextProfile
}

function getRecords() {
  const records = wx.getStorageSync(RECORDS_KEY)
  if (!Array.isArray(records)) return []

  return records.sort(function (a, b) {
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
  const nextRecord = Object.assign({}, record, {
    id: record.id || 'record_' + Date.now(),
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
  const records = getRecords()
  const profile = getProfile()
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
  deleteRecord: deleteRecord,
  formatDate: formatDate,
  getProfile: getProfile,
  getRecordById: getRecordById,
  getRecordTitle: getRecordTitle,
  getRecords: getRecords,
  getStats: getStats,
  saveProfile: saveProfile,
  saveRecord: saveRecord
}
