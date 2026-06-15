export default defineAppConfig({
  pages: [
    'pages/loading/index',
    'pages/transport/index',
    'pages/arrival/index',
    'pages/stats/index',
    'pages/batch-detail/index',
    'pages/transport-detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#0ea5e9',
    navigationBarTitleText: '冷链装车助手',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#0ea5e9',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/loading/index',
        text: '装车'
      },
      {
        pagePath: 'pages/transport/index',
        text: '运输'
      },
      {
        pagePath: 'pages/arrival/index',
        text: '到站'
      },
      {
        pagePath: 'pages/stats/index',
        text: '统计'
      }
    ]
  }
})
