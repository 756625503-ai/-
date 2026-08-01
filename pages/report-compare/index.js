const storage = require('../../utils/storage')

const MAX_COMPARE = 3
const MIN_COMPARE = 2

function getYear(value) {
  const dateText = storage.formatDate(value)
  if (!dateText || dateText === '未填写') return '未填年份'
  return dateText.slice(0, 4)
}

function getReportTitle(record) {
  if (record.title) return record.title
  if (record.type === '体检') return '体检报告'
  if (record.type === '检查报告' || record.type === '检查') return '检查记录'
  return storage.getRecordTitle(record)
}

function getReportMeta(record) {
  return [
    storage.formatDate(record.visitDate || record.createdAt),
    record.hospital || '未填写医院',
    record.department || ''
  ].filter(Boolean).join(' · ')
}

function isReportCandidate(record) {
  const files = Array.isArray(record.files) ? record.files : []
  const text = [
    record.type,
    record.title,
    record.summary,
    record.diagnosis,
    record.advice
  ].concat(files.map(function (file) {
    return [file.title, file.name].join(' ')
  })).join(' ')

  return record.type === '体检' ||
    record.type === '检查' ||
    record.type === '检查报告' ||
    text.indexOf('体检') >= 0 ||
    text.indexOf('检查') >= 0 ||
    text.indexOf('报告') >= 0 ||
    files.length > 0
}

function getFilesText(files) {
  if (!Array.isArray(files) || !files.length) return '未上传附件'
  return files.map(function (file, index) {
    return file.title || file.name || ('附件' + (index + 1))
  }).join('、')
}

function normalizeRecord(record, selectedIds) {
  const files = Array.isArray(record.files) ? record.files : []
  const selected = selectedIds.indexOf(record.id) >= 0

  return Object.assign({}, record, {
    compareYear: getYear(record.visitDate || record.createdAt),
    displayDate: storage.formatDate(record.visitDate || record.createdAt),
    reportTitle: getReportTitle(record),
    reportMeta: getReportMeta(record),
    selected: selected,
    selectedClass: selected ? 'report-selected' : '',
    fileCountText: files.length ? files.length + '个附件' : '无附件',
    filesText: getFilesText(files),
    files: files
  })
}

function getText(value) {
  return value ? String(value) : '未填写'
}

function buildCompareRows(records) {
  const rowDefs = [
    { label: '日期', field: 'displayDate' },
    { label: '记录类型', field: 'type' },
    { label: '医院', field: 'hospital' },
    { label: '科室', field: 'department' },
    { label: '医生', field: 'doctor' },
    { label: '主要情况', field: 'summary' },
    { label: '诊断结果', field: 'diagnosis' },
    { label: '医生建议', field: 'advice' },
    { label: '药方 / 用药', field: 'medicines' },
    { label: '附件', field: 'filesText' }
  ]

  return rowDefs.map(function (row) {
    return {
      label: row.label,
      values: records.map(function (record) {
        return getText(record[row.field])
      })
    }
  })
}

Page({
  data: {
    profiles: [],
    activeProfileId: '',
    activeProfileName: '',
    reports: [],
    selectedIds: [],
    comparedRecords: [],
    compareRows: [],
    minCompare: MIN_COMPARE,
    maxCompare: MAX_COMPARE
  },

  onShow() {
    this.loadReports()
  },

  loadReports() {
    const profiles = storage.getProfiles().map(function (profile) {
      return Object.assign({}, profile, {
        displayName: storage.getProfileDisplayName(profile)
      })
    })
    const activeProfileId = storage.getSelectedProfileId()
    const activeProfile = storage.getProfileById(activeProfileId)
    const allRecords = storage.getRecords({ profileId: activeProfileId })
    const candidateRecords = allRecords.filter(isReportCandidate)
    const records = candidateRecords.length ? candidateRecords : allRecords
    const validIds = records.map(function (record) {
      return record.id
    })
    let selectedIds = this.data.selectedIds.filter(function (id) {
      return validIds.indexOf(id) >= 0
    })

    if (selectedIds.length < MIN_COMPARE) {
      selectedIds = records.slice(0, MIN_COMPARE).map(function (record) {
        return record.id
      })
    }

    selectedIds = selectedIds.slice(0, MAX_COMPARE)

    this.setData({
      profiles: profiles,
      activeProfileId: activeProfileId,
      activeProfileName: storage.getProfileDisplayName(activeProfile)
    })
    this.applySelection(selectedIds, records)
  },

  applySelection(selectedIds, records) {
    const sourceRecords = records || this.data.reports
    const reports = sourceRecords.map(function (record) {
      return normalizeRecord(record, selectedIds)
    })
    const comparedRecords = reports.filter(function (record) {
      return selectedIds.indexOf(record.id) >= 0
    })

    this.setData({
      reports: reports,
      selectedIds: selectedIds,
      comparedRecords: comparedRecords,
      compareRows: buildCompareRows(comparedRecords)
    })
  },

  changeProfile(event) {
    storage.setSelectedProfileId(event.currentTarget.dataset.id)
    this.setData({
      selectedIds: []
    })
    this.loadReports()
  },

  toggleReport(event) {
    const id = event.currentTarget.dataset.id
    const selectedIds = this.data.selectedIds.slice()
    const index = selectedIds.indexOf(id)

    if (index >= 0) {
      selectedIds.splice(index, 1)
      this.applySelection(selectedIds)
      return
    }

    if (selectedIds.length >= MAX_COMPARE) {
      wx.showToast({
        title: '最多选择3份',
        icon: 'none'
      })
      return
    }

    selectedIds.push(id)
    this.applySelection(selectedIds)
  },

  openRecord(event) {
    wx.navigateTo({
      url: '/pages/record-edit/index?id=' + event.currentTarget.dataset.id
    })
  },

  goAddRecord() {
    wx.navigateTo({
      url: '/pages/record-edit/index'
    })
  }
})
