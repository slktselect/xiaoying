import { Component } from 'react';

/**
 * 渲染错误边界：简历内容全靠 resume.config.js 驱动，手改出错时
 * （比如某个字段写坏）不该整个白屏，而是给一句人话 + 刷新按钮。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 具体错误进控制台，页面上只展示通用提示
    console.error('简历页面渲染出错：', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">页面出错了</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          简历页面渲染时发生异常。如果你是刚改过
          <code className="mx-1 rounded bg-slate-100 px-1">src/resume.config.js</code>
          ，可以先检查那里的格式；否则请稍后刷新重试。
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          刷新页面
        </button>
      </div>
    );
  }
}
