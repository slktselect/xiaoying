import { useEffect, useState } from 'react';
import useSignedUrl from './useSignedUrl';

/**
 * 判断视频是横版还是竖版。
 *
 * 用封面图判断：封面和视频本身同比例，而且**不依赖播放**——
 * autoplay 被浏览器拦截时 hls.js 不加载数据，`video.videoWidth` 一直是 0，
 * 靠 `loadedmetadata` 判方向会失灵（实测过：headless 里除自动播成功的
 * 那个外全是 0，真实用户同样会遇到）。
 *
 * 放在 Gallery 层而不是 Hero 层，是为了让外层能按方向切换栅格比例
 * （横版时把播放器那栏拉宽）；Hero 通过 prop 接收，不重复探测。
 *
 * @param {string} posterKey  R2 对象 key（`videos/<slug>/poster.jpg`）
 * @returns {boolean|null} true=横版，false=竖版，null=还不知道（没封面/没加载完）
 */
export default function useVideoOrientation(posterKey) {
  const { url } = useSignedUrl(posterKey);
  const [wide, setWide] = useState(null);

  useEffect(() => {
    setWide(null); // 换视频/换封面时回到未知
    if (!url) return undefined;
    let alive = true;
    const im = new Image();
    im.onload = () => {
      if (alive && im.naturalWidth && im.naturalHeight) {
        setWide(im.naturalWidth >= im.naturalHeight);
      }
    };
    im.src = url;
    return () => {
      alive = false;
    };
  }, [url]);

  return wide;
}
