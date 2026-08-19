const FIELD_RULES = [
  {
    field: 'summary',
    headings: ['主要情况', '主诉', '现病史', '症状', '检查所见', '检查结果', '检验结果', '体检异常', '阳性发现', '临床资料']
  },
  {
    field: 'diagnosis',
    headings: ['诊断结果', '初步诊断', '临床诊断', '出院诊断', '影像诊断', '影像学诊断', '检查结论', '检验结论', '诊断意见', '诊断', '结论', '印象', '提示']
  },
  {
    field: 'medicines',
    headings: ['药方/用药', '药方', '处方', '用药情况', '治疗用药', '药物治疗', '用药', '药品', '药物']
  },
  {
    field: 'advice',
    headings: ['医生建议', '复查建议', '随访建议', '健康指导', '处理意见', '注意事项', '医嘱', '建议']
  }
]

const STOP_HEADINGS = /^(?:患者信息|基本信息|姓名|性别|年龄|科室|医院|检查项目|检验项目|申请医生|报告医生|审核医生|检查日期|报告日期|打印日期|联系方式|地址)\s*[:：]?/
const MAX_FIELD_LENGTH = 3000

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanLine(value) {
  return String(value || '')
    .replace(/^[\s•·●○▪■◆◇★☆※*#一二三四五六七八九十0-9]+[、.)）]\s*/, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function normalizeLines(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)
}

function buildHeadingMatchers() {
  return FIELD_RULES.map(function (rule) {
    const aliases = rule.headings.slice().sort(function (left, right) {
      return right.length - left.length
    })
    return {
      field: rule.field,
      pattern: new RegExp('^(' + aliases.map(escapeRegExp).join('|') + ')(?:\\s*[:：]\\s*|\\s+)?(.*)$')
    }
  })
}

const HEADING_MATCHERS = buildHeadingMatchers()

function readHeading(line) {
  for (let index = 0; index < HEADING_MATCHERS.length; index += 1) {
    const matcher = HEADING_MATCHERS[index]
    const match = line.match(matcher.pattern)
    if (match) {
      return {
        field: matcher.field,
        content: cleanLine(match[2] || '')
      }
    }
  }
  return null
}

function classifyFallback(line) {
  if (/(?:口服|外用|静滴|肌注|每次|每日|一日\s*\d|每晚|睡前|饭前|饭后|\d+(?:\.\d+)?\s*(?:mg|g|ml|片|粒|袋|支|丸|滴))|(?:片剂|胶囊|颗粒|注射液|口服液)/i.test(line)) {
    return 'medicines'
  }
  if (/(?:建议|医嘱|复查|复诊|随访|定期监测|注意休息|清淡饮食|控制饮食|加强运动|避免劳累)/.test(line)) {
    return 'advice'
  }
  if (/(?:诊断为|考虑为|考虑系|提示[:：]?|符合.{0,12}诊断|印象[:：]?|结论[:：]?)/.test(line)) {
    return 'diagnosis'
  }
  if (/(?:主诉|症状|不适|疼痛|发热|咳嗽|头晕|心悸|恶心|呕吐|检查所见|检查结果|检验结果|异常项|阳性发现)/.test(line)) {
    return 'summary'
  }
  return ''
}

function appendUnique(target, field, value) {
  const content = cleanLine(value)
  if (!content || target[field].indexOf(content) >= 0) return
  target[field].push(content)
}

function extractMedicalSections(text) {
  const result = {
    summary: [],
    diagnosis: [],
    medicines: [],
    advice: []
  }
  const lines = normalizeLines(text)
  let activeField = ''

  lines.forEach(function (line) {
    const heading = readHeading(line)
    if (heading) {
      activeField = heading.field
      appendUnique(result, activeField, heading.content)
      return
    }

    if (STOP_HEADINGS.test(line)) {
      activeField = ''
      return
    }

    if (activeField) {
      appendUnique(result, activeField, line)
      return
    }

    const fallbackField = classifyFallback(line)
    if (fallbackField) appendUnique(result, fallbackField, line)
  })

  return Object.keys(result).reduce(function (fields, field) {
    fields[field] = result[field].join('\n').slice(0, MAX_FIELD_LENGTH)
    return fields
  }, {})
}

module.exports = {
  extractMedicalSections: extractMedicalSections
}
