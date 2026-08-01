const storage = require('../../utils/storage')
const reportMetrics = require('../../utils/report-metrics')

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
  return storage.formatDate(record.visitDate || record.createdAt)
}

function isReportCandidate(record) {
  const files = Array.isArray(record.files) ? record.files : []
  const ocrText = reportMetrics.getOcrText(record)
  const text = [
    record.type,
    record.title,
    record.summary,
    record.diagnosis,
    record.advice,
    ocrText
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
  const ocrText = reportMetrics.getOcrText(record)
  const extractedMetrics = reportMetrics.extractMetricsFromText(ocrText)
  const metricCount = Object.keys(extractedMetrics).length
  const recognizedCount = files.filter(function (file) {
    return Boolean(file.ocrText)
  }).length
  const selected = selectedIds.indexOf(record.id) >= 0

  return Object.assign({}, record, {
    compareYear: getYear(record.visitDate || record.createdAt),
    displayDate: storage.formatDate(record.visitDate || record.createdAt),
    reportTitle: getReportTitle(record),
    reportMeta: getReportMeta(record),
    selected: selected,
    selectedClass: selected ? 'report-selected' : '',
    fileCountText: files.length ? files.length + '个附件' : '无附件',
    metricCountText: metricCount ? metricCount + '项指标' : '未识别指标',
    ocrSummaryText: recognizedCount ? '已识别' + recognizedCount + '/' + files.length + '个附件' : '待识别附件',
    extractedMetrics: extractedMetrics,
    ocrText: ocrText,
    filesText: getFilesText(files),
    files: files
  })
}

function getText(value) {
  return value ? String(value) : '未填写'
}

function buildCompareRows(records) {
  const baseRows = [
    {
      label: '报告日期',
      values: records.map(function (record) {
        return getText(record.displayDate)
      })
    },
    {
      label: '附件识别',
      values: records.map(function (record) {
        return record.ocrSummaryText
      })
    }
  ]
  const metricRows = reportMetrics.METRIC_DEFINITIONS.map(function (definition) {
    const values = records.map(function (record) {
      return reportMetrics.formatMetric(record.extractedMetrics[definition.key])
    })
    const hasMetric = values.some(function (value) {
      return value !== '未识别'
    })

    if (!hasMetric) return null

    return {
      label: definition.label,
      values: values
    }
  }).filter(Boolean)

  if (!metricRows.length) {
    return baseRows.concat({
      label: '识别结果',
      values: records.map(function () {
        return '未识别到可对比指标'
      })
    })
  }

  return baseRows.concat(metricRows)
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
