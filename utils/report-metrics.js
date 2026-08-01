const METRIC_DEFINITIONS = [
  { key: 'height', label: '身高', aliases: ['身高'], unit: 'cm' },
  { key: 'weight', label: '体重', aliases: ['体重'], unit: 'kg' },
  { key: 'bmi', label: 'BMI', aliases: ['BMI', '体质指数'], unit: '' },
  { key: 'systolicPressure', label: '收缩压', aliases: ['收缩压', '高压'], unit: 'mmHg' },
  { key: 'diastolicPressure', label: '舒张压', aliases: ['舒张压', '低压'], unit: 'mmHg' },
  { key: 'fastingGlucose', label: '空腹血糖', aliases: ['空腹血糖', '葡萄糖', 'GLU'], unit: 'mmol/L' },
  { key: 'totalCholesterol', label: '总胆固醇', aliases: ['总胆固醇', 'TC'], unit: 'mmol/L' },
  { key: 'triglyceride', label: '甘油三酯', aliases: ['甘油三酯', 'TG'], unit: 'mmol/L' },
  { key: 'hdl', label: '高密度脂蛋白', aliases: ['高密度脂蛋白', 'HDL'], unit: 'mmol/L' },
  { key: 'ldl', label: '低密度脂蛋白', aliases: ['低密度脂蛋白', 'LDL'], unit: 'mmol/L' },
  { key: 'uricAcid', label: '尿酸', aliases: ['尿酸', 'UA'], unit: 'umol/L' },
  { key: 'creatinine', label: '肌酐', aliases: ['肌酐', 'CREA', 'Cr'], unit: 'umol/L' },
  { key: 'alt', label: '谷丙转氨酶', aliases: ['谷丙转氨酶', '丙氨酸氨基转移酶', 'ALT'], unit: 'U/L' },
  { key: 'ast', label: '谷草转氨酶', aliases: ['谷草转氨酶', '天门冬氨酸氨基转移酶', 'AST'], unit: 'U/L' },
  { key: 'hemoglobin', label: '血红蛋白', aliases: ['血红蛋白', 'HGB'], unit: 'g/L' },
  { key: 'whiteBloodCell', label: '白细胞', aliases: ['白细胞', 'WBC'], unit: '10^9/L' },
  { key: 'platelet', label: '血小板', aliases: ['血小板', 'PLT'], unit: '10^9/L' }
]

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeText(value) {
  return String(value || '')
    .replace(/[：]/g, ':')
    .replace(/[，]/g, ',')
    .replace(/[－]/g, '-')
    .replace(/\s+/g, ' ')
}

function getOcrText(record) {
  const files = Array.isArray(record.files) ? record.files : []
  return files.map(function (file) {
    return file.ocrText || ''
  }).filter(Boolean).join('\n')
}

function readMetric(text, definition) {
  const normalizedText = normalizeText(text)
  for (let i = 0; i < definition.aliases.length; i += 1) {
    const alias = definition.aliases[i]
    const pattern = new RegExp(escapeRegExp(alias) + '[^0-9<>+-]{0,18}([<>+-]?\\d+(?:\\.\\d+)?)', 'i')
    const match = normalizedText.match(pattern)
    if (match && match[1]) {
      const rawValue = match[1]
      const numericValue = Number(rawValue.replace(/[<>+]/g, ''))
      return {
        value: rawValue,
        numericValue: Number.isNaN(numericValue) ? null : numericValue,
        unit: definition.unit
      }
    }
  }

  return null
}

function extractMetricsFromText(text) {
  const metrics = {}
  METRIC_DEFINITIONS.forEach(function (definition) {
    const metric = readMetric(text, definition)
    if (metric) {
      metrics[definition.key] = Object.assign({}, metric, {
        key: definition.key,
        label: definition.label
      })
    }
  })
  return metrics
}

function formatMetric(metric) {
  if (!metric) return '未识别'
  return metric.value + (metric.unit ? ' ' + metric.unit : '')
}

module.exports = {
  METRIC_DEFINITIONS: METRIC_DEFINITIONS,
  extractMetricsFromText: extractMetricsFromText,
  formatMetric: formatMetric,
  getOcrText: getOcrText
}
