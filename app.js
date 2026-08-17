App({
  onLaunch() {
    if (wx.cloud) {
      try {
        wx.cloud.init({
          env: 'a20260817-d8gzfervr3e25b34f',
          traceUser: true
        })
      } catch (error) {}
    }

    const storage = require('./utils/storage')
    storage.ensureData()
  }
})
