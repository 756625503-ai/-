App({
  onLaunch() {
    if (wx.cloud) {
      try {
        wx.cloud.init({
          traceUser: true
        })
      } catch (error) {}
    }

    const storage = require('./utils/storage')
    storage.ensureData()
  }
})
