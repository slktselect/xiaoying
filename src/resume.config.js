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
 *   photoSections 摄影作品，按分类分组，含拍摄设备；照片 key 同样是 R2 对象名
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
    name: '史志颖',
    // 岗位 / 求职意向，显示在姓名下方
    title: '应聘岗位：视频剪辑 | 9年视频拍摄剪辑经验',
    // 头像图片地址，留空则显示姓名首字
    avatar: '',
    // 一句话简介，显示在头部
    summary: '精通影视后期全流程，擅长宣传片、短视频、影视特效制作，兼具项目实操与教学经验',
  },

  /* ---------------- 联系方式 ---------------- */
  // href 写法：电话 tel:13800000000 / 邮箱 mailto:xxx@xx.com / 网址 https://...
  contacts: [
    { label: '电话', value: '189‑5452‑5529', href: 'tel:18954525529' },
    { label: '邮箱', value: '1623112322@qq.com', href: 'mailto:1623112322@qq.com' },
    { label: '期望城市', value: '上海', href: '' },
    { label: '期望薪资', value: '9‑14K', href: '' },
  ],

  /* ---------------- 介绍视频（按分区嵌套） ---------------- */
  // 每个 section：title 必填、desc 简介（可空）、videos 数组
  // 用 video-workflow/slice.py 路径 1/2 追加；手动加也行
  // 与正文分区的区别：这里有 videos 字段（数组）；正文分区用 items 字段
  sections: [
    {
      title: 'MCN账号视频',
      desc: '此文件夹视频是我在mcn公司（贝壳视频）就职期间制作。基本为当时公司的原创孵化账号，基本由我全程 编 拍 剪。',
      videos: [
        {
          key: 'videos/溜溜梅/index.m3u8',
          title: '溜溜梅',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/溜溜梅/poster.jpg',
        },
        {
          key: 'videos/红酒账号/index.m3u8',
          title: '红酒账号',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/红酒账号/poster.jpg',
        },
        {
          key: 'videos/芒果布丁/index.m3u8',
          title: '芒果布丁',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/芒果布丁/poster.jpg',
        },
        {
          key: 'videos/4-16酒吧/index.m3u8',
          title: '4.16酒吧',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/4-16酒吧/poster.jpg',
        },
        {
          key: 'videos/美妆/index.m3u8',
          title: '美妆',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/美妆/poster.jpg',
        }
      ],
    },
    {
      title: '网剧（灵瞳鉴宝）',
      desc: '此剧为几年前我业余时间剪辑制作，原素材由片方提供。我只负责剪辑。\n按协议当时不能留存原片。目前此剧已经过保密期，向片方的朋友要了两条原始成片\n（完全成片找不到了，据说播放效果一般，没人专门留存）',
      videos: [
        {
          key: 'videos/样片-0-457/index.m3u8',
          title: '样片 0.457',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/样片-0-457/poster.jpg',
        },
        {
          key: 'videos/8-0-1/index.m3u8',
          title: '8.0.1',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/8-0-1/poster.jpg',
        }
      ],
    },
    {
      title: '政府事业单位承包视频',
      desc: '此文件夹两条视频为代运营期间制作，电视台文旅视频为自己承接的活。编 拍 剪由我全程负责。',
      videos: [
        {
          key: 'videos/华安检测/index.m3u8',
          title: '华安检测',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/华安检测/poster.jpg',
        },
        {
          key: 'videos/济南历下市场监督管理局/index.m3u8',
          title: '济南历下市场监督管理局',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/济南历下市场监督管理局/poster.jpg',
        },
        {
          key: 'videos/电视台-文旅系列1-横屏超清/index.m3u8',
          title: '电视台 文旅系列1 横屏超清',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/电视台-文旅系列1-横屏超清/poster.jpg',
        },
        {
          key: 'videos/齐河文旅1-抖音竖屏横版/index.m3u8',
          title: '齐河文旅1 抖音竖屏横版',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/齐河文旅1-抖音竖屏横版/poster.jpg',
        }
      ],
    },
    {
      title: '信息流',
      desc: '此文件夹视频全部为业余时间接的信息流剪辑，素材由甲方提供，我只负责剪辑。',
      videos: [
        {
          key: 'videos/0606-康恩贝90蛋白粉-宣传5-混剪-晟果-szy/index.m3u8',
          title: '0606-康恩贝90蛋白粉-宣传5-混剪-晟果-SZY',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/0606-康恩贝90蛋白粉-宣传5-混剪-晟果-szy/poster.jpg',
        },
        {
          key: 'videos/5-14-光感水-日常向-混剪-功效1-2-szy/index.m3u8',
          title: '5.14-光感水-日常向-混剪-功效1.2-szy',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/5-14-光感水-日常向-混剪-功效1-2-szy/poster.jpg',
        },
        {
          key: 'videos/5-15-谷雨面霜-日常向-混剪-功效7-szy/index.m3u8',
          title: '5.15-谷雨面霜-日常向-混剪-功效7-szy',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/5-15-谷雨面霜-日常向-混剪-功效7-szy/poster.jpg',
        },
        {
          key: 'videos/5-15-谷雨面霜-日常向-混剪-口播4-szy-改1/index.m3u8',
          title: '5.15-谷雨面霜-日常向-混剪-口播4-szy（改1）',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/5-15-谷雨面霜-日常向-混剪-口播4-szy-改1/poster.jpg',
        },
        {
          key: 'videos/5-21-日常_晶冻_基础款_达人_亚比_szy/index.m3u8',
          title: '5.21-日常_晶冻_基础款_达人_亚比_SZY',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/5-21-日常_晶冻_基础款_达人_亚比_szy/poster.jpg',
        }
      ],
    },
    {
      title: '账号：你好，李涵',
      desc: '视频账号名为：你好李涵  平台：bilibili  账号运营者为我的朋友，有时会有偿帮他剪片子。\n脚本由对方提供，剪辑风格和最终效果由他确定。我负责拍摄 剪辑。\n账号主页部分视频有我客串镜头。',
      videos: [
        {
          key: 'videos/ls-0672/index.m3u8',
          title: 'LS-0672',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/ls-0672/poster.jpg',
        },
        {
          key: 'videos/ls-0531/index.m3u8',
          title: 'LS-0531',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/ls-0531/poster.jpg',
        }
      ],
    },
    {
      title: '现就职公司品宣视频',
      desc: '此文件夹视频为现就职公司剪辑视频，由我全程负责剪辑和后期制作。\n素材来自公司会议固定存档、网络素材、AI生成，也有部分是我现场实拍。\n视频主要用于公司品牌宣传，会在公司会议  接待外宾时播放，也会在公众号 视频号上更新。\n目前最新版与此有出入，此为早期版本。',
      videos: [
        {
          key: 'videos/第七届卢浮宫总视频11-11/index.m3u8',
          title: '第七届卢浮宫总视频11.11',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/第七届卢浮宫总视频11-11/poster.jpg',
        },
        {
          key: 'videos/集团宣传-英文版11-3/index.m3u8',
          title: '集团宣传 英文版11.3',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/集团宣传-英文版11-3/poster.jpg',
        },
        {
          key: 'videos/集团宣传-中文-1-19/index.m3u8',
          title: '集团宣传-中文 1.19',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/集团宣传-中文-1-19/poster.jpg',
        }
      ],
    },
    {
      title: '抠像合成（刚毕业时做的，可以不看）',
      desc: '早期实习时负责电视剧的合成包装特效，参与电视剧：风声  香蜜沉沉烬如霜后期制作（电视剧风声片尾可在合成组查询到我的名字）。\n当时严格要求成片保密，所以没有成片留存。当时自己做了个小演示视频用于求职。',
      videos: [
        {
          key: 'videos/demo醉玲珑-上古情歌/index.m3u8',
          title: 'demo醉玲珑 上古情歌',
          desc: '',
          // 封面图：R2 对象 key（切片时抽的第一帧），留空则显占位
          poster: 'videos/demo醉玲珑-上古情歌/poster.jpg',
        }
      ],
    },

    /* ---------------- 正文分区 ---------------- */
    {
      id: 'skills',
      title: '专业技能',
      // 技能类分区：只有 title + tags
      items: [
        { title: '剪辑后期软件', tags: ['Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Nuke', 'Photoshop'] },
        { title: '业务能力', tags: ['短视频全流程', '宣传片/纪录片制作', '影视特效合成', '调色修音', '脚本策划', '账号孵化'] },
        { title: '其他经验', tags: ['项目对接甲方', '课程教学', '项目管理', '政企/MCN商单'] },
      ],
    },
    {
      id: 'work',
      title: '工作经历',
      items: [
        {
          title: '山东三月数字经济产业园运营管理有限公司',
          subtitle: '视频剪辑',
          period: '2024.11 - 2026.10',
          meta: '山东',
          bullets: [
            '全流程负责大型会议、签约仪式、团建活动现场摄像，素材整理归档；独立策划剪辑业务推介宣传片、企业文化短视频。',
            '跨部门对接金融、教育、IT、文化多业务线，挖掘宣传重点，适配不同使用场景调整叙事风格，完成拍摄、剪辑、调色、字幕包装，输出对外商务及内部传播物料。'
          ],
          tags: ['宣传片', '活动摄像', '短视频', '全链路视频制作'],
        },
        {
          title: '山东齐鲁融媒乡村振兴研究院有限责任公司',
          subtitle: '专业课教师',
          period: '2022.01 - 2024.06',
          meta: '山东',
          bullets: [
            '主讲摄影摄像基础、数字视觉艺术、影视特效、新媒体营销、短视频创作实战课程。',
            '理论结合项目式实践教学，组织行业讲座与实地考察，多名学生作品在校内外比赛获奖。'
          ],
          tags: ['摄影教学', '后期教学', '新媒体', '短视频实战'],
        },
        {
          title: '艾普科创(山东)有限公司',
          subtitle: '视频剪辑',
          period: '2020.06 - 2021.11',
          meta: '山东',
          bullets: [
            '承接政企短视频代运营项目，对接甲方、编导沟通需求，完成外景实地拍摄与素材采集。',
            '独立完成剪辑包装、素材二次创作，统筹调色、修音、字幕全流程；参与桃花姬、齐河旅游账号孵化，产出企业品宣、文旅类短视频，助力品牌曝光推广。'
          ],
          tags: ['政企代运营', '文旅宣传', '账号孵化'],
        },
        {
          title: '北京奔跑吧贝壳文化传播有限公司',
          subtitle: '视频剪辑',
          period: '2018.10 - 2020.04',
          meta: '北京',
          bullets: [
            '负责抖音平台短视频全流程拍摄，现场取景录制素材，适配网红IP、品牌商单多种风格。',
            '独立完成短视频剪辑、包装、字幕调色后期，配合脚本二次创作输出账号日常及商单视频。',
            '参与MCN自有账号孵化，对接达人打磨脚本，输出短视频内容，助力账号涨粉与商业广告承接。'
          ],
          tags: ['MCN', '网红短视频', '商单视频'],
        },
        {
          title: '青岛枫彩电影科技有限公司',
          subtitle: '后期制作',
          period: '2017.11 - 2018.06',
          meta: '青岛',
          bullets: [
            '负责电影、电视剧项目后期特效合成制作。'
          ],
          tags: ['影视后期', '特效合成'],
        }
      ],
    },
    {
      id: 'projects',
      title: '项目经历',
      items: [
        {
          title: '影视剧后期特效制作',
          subtitle: '影视项目',
          period: '2017.11‑2018.06',
          bullets: [
            '参与《风声》电视剧版、《香蜜沉沉烬如霜》、《高能少年团》片头的特效合成制作。'
          ],
          tags: ['电视剧', '综艺片头', '特效合成']
        }
      ],
    },
    {
      id: 'education',
      title: '教育背景',
      items: [
        {
          title: '山东劳动职业技术学院',
          subtitle: '数字媒体艺术 · 大专',
          period: '2015 - 2018',
        },
      ],
    },
  ],
  /* ---------------- 摄影作品（按分类嵌套） ---------------- */
  // 每个分类：title 分类名、device 拍摄设备（来自随图说明文件）、photos 数组
  // key 是 R2 里的对象名（photos/<分类>/<序号>.jpg），与视频共用签名分发通道
  photoSections: [
    {
      title: '空间设计',
      device: 'Canon 5D4 + 24-105mm 镜头',
      photos: [
        { key: 'photos/空间设计/01.jpg', title: '空间设计 01' },
        { key: 'photos/空间设计/02.jpg', title: '空间设计 02' },
        { key: 'photos/空间设计/03.jpg', title: '空间设计 03' },
        { key: 'photos/空间设计/04.jpg', title: '空间设计 04' },
        { key: 'photos/空间设计/05.jpg', title: '空间设计 05' },
      ],
    },
    {
      title: '花海',
      device: 'Canon 5D4 + 85mm 定焦',
      photos: [
        { key: 'photos/花海/01.jpg', title: '花海 01' },
        { key: 'photos/花海/02.jpg', title: '花海 02' },
        { key: 'photos/花海/03.jpg', title: '花海 03' },
        { key: 'photos/花海/04.jpg', title: '花海 04' },
        { key: 'photos/花海/05.jpg', title: '花海 05' },
        { key: 'photos/花海/06.jpg', title: '花海 06' },
      ],
    },
    {
      title: '青岛啤酒',
      device: 'Canon 5D4 + 50mm 定焦',
      photos: [
        { key: 'photos/青岛啤酒/01.jpg', title: '青岛啤酒 01' },
        { key: 'photos/青岛啤酒/02.jpg', title: '青岛啤酒 02' },
        { key: 'photos/青岛啤酒/03.jpg', title: '青岛啤酒 03' },
        { key: 'photos/青岛啤酒/04.jpg', title: '青岛啤酒 04' },
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
