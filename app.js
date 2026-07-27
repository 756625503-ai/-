App({
  onLaunch() {
    const storage = require('./utils/storage')
    storage.ensureData()
  }
})
