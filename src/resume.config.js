/**
 * ============================================================
 *  简历内容配置 —— 改简历只需要动这个文件
 * ============================================================
 *
 * 改完保存后执行：
 *   npm run deploy      # 构建 + 部署到 Cloudflare
 *   npm run dev         # 本地预览（改这个文件时页面会热更新）
 *
 * 字段说明：
 *   profile   基本信息（姓名 / 岗位 / 头像 / 一句话简介）
 *   contacts  联系方式列表，href 留空则只显示文字不生成链接
 *   videos    介绍视频，key 是 R2 里的对象名（HLS 播放列表或 mp4）
 *   sections  正文分区，按顺序渲染；id 会被导航锚点用到，不要重复
 *   share     右下角分享二维码的开关与文案
 *   footer    页脚文案
 *
 * 小提示：
 *   - tags 用于渲染成小标签，可有可无
 *   - bullets 是会渲染成圆点列表的职责/成果描述
 *   - 不需要的分区直接删掉或设 hidden: true，导航会自动消失
 */

const resume = {
  /* ---------------- 基本信息 ---------------- */
  profile: {
    name: '小颖',
    // 岗位 / 求职意向，显示在姓名下方
    title: '应聘岗位：剪辑师',
    // 头像图片地址，留空则显示姓名首字
    avatar: '',
    // 一句话简介，显示在头部
    summary: '专业剪辑大师',
  },

  /* ---------------- 联系方式 ---------------- */
  // href 写法：电话 tel:13800000000 / 邮箱 mailto:xxx@xx.com / 网址 https://...
  contacts: [
    { label: '电话', value: '138-0000-0000', href: 'tel:13800000000' },
    { label: '邮箱', value: 'yourname@example.com', href: 'mailto:yourname@example.com' },
    { label: 'GitHub', value: 'github.com/yourname', href: 'https://github.com/yourname' },
    { label: '所在地', value: '济南', href: '' },
  ],

  /* ---------------- 介绍视频 ---------------- */
  // key 必须是 worker 侧 VIDEO_KEYS 白名单允许的对象名
  // 目前 R2 里存的是 HLS 切片（hls/index.m3u8），改成 mp4 也能播
  videos: [
    {
      key: 'hls/index.m3u8',
      title: '作品展示',
      desc: '存放于 Cloudflare R2，播放地址由 Worker 临时签发。',
      // 封面图，留空则用视频第一帧
      poster: '',
    },
  ],

  /* ---------------- 正文分区 ---------------- */
  sections: [
    {
      id: 'skills',
      title: '专业技能',
      // 技能类分区：只有 title + tags
      items: [
        { title: '前端框架', tags: ['Vue 3', 'React', 'TypeScript'] },
        { title: '工程化', tags: ['Vite', 'Webpack', 'Monorepo', 'CI/CD'] },
        { title: '后端与云服务', tags: ['Node.js', 'Cloudflare Workers', 'Serverless'] },
      ],
    },
    {
      id: 'work',
      title: '工作经历',
      items: [
        {
          title: '某某科技有限公司',
          subtitle: '高级前端工程师',
          period: '2022.03 - 至今',
          meta: '上海 · 技术部',
          bullets: [
            '负责核心业务前端架构升级，首屏加载时间从 3.2s 降至 1.1s。',
            '搭建组件库与脚手架，覆盖 6 条业务线，需求交付周期缩短 30%。',
          ],
          tags: ['Vue 3', 'Vite', '性能优化'],
        },
        {
          title: '某某网络科技',
          subtitle: '前端工程师',
          period: '2020.07 - 2022.02',
          meta: '杭州',
          bullets: ['参与中后台系统建设，独立完成权限、表单引擎等通用模块。'],
          tags: ['React', 'Ant Design'],
        },
      ],
    },
    {
      id: 'projects',
      title: '项目经历',
      items: [
        {
          title: '在线简历站点',
          subtitle: '个人项目',
          period: '2026',
          bullets: [
            '静态资源托管在 Cloudflare Workers，视频存储于 R2 并通过 Worker 签发短期签名 URL 防盗链。',
          ],
          tags: ['Cloudflare Workers', 'R2'],
          links: [{ label: '在线地址', href: 'https://example.com' }],
        },
      ],
    },
    {
      id: 'education',
      title: '教育背景',
      items: [
        {
          title: '某某大学',
          subtitle: '计算机科学与技术 · 本科',
          period: '2016.09 - 2020.06',
        },
      ],
    },
  ],

  /* ---------------- 分享二维码 ---------------- */
  share: {
    enabled: true,
    title: '扫码在手机上查看',
    tip: '二维码内容只有本页网址，不含任何个人信息',
  },

  /* ---------------- 页脚 ---------------- */
  footer: {
    // 留空则用默认文案（© 年份 姓名 · Powered by ...）
    text: '',
  },
};

export default resume;
