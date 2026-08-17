const CLOUD_ENV_ID = 'cloud1-d2gne6k3g8c609034'

App({
  globalData: {
    cloudEnvId: CLOUD_ENV_ID,
    cloudReady: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前微信基础库不支持云开发，请升级微信或调整基础库版本。')
    } else {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
      this.globalData.cloudReady = true
    }

    const storage = require('./utils/storage')
    storage.ensureData()
  }
})
