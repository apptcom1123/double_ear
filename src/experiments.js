export const arpeggioStyles = {
  off: { label: "關閉", description: "只聽其他聲層", density: 0, notes: [0] },
  dew: { label: "晨露點光", description: "稀疏、透明、留白較多", density: 0.55, notes: [0, 7, 12, 19], octave: 2, duration: 0.08 },
  vine: { label: "藤蔓上升", description: "音高逐步攀升再回落", density: 1.3, notes: [0, 2, 5, 9, 12, 16, 12, 9, 5], octave: 1, duration: 0.16, sequence: true },
  spores: { label: "孢子群聚", description: "短促音群成片出現", density: 3.8, notes: [0, 3, 7, 10, 14], octave: 2, duration: 0.055, burst: true },
  crystal: { label: "晶體折射", description: "五度與八度的明亮跳躍", density: 1.8, notes: [0, 7, 12, 19, 24], octave: 2, duration: 0.12 },
  firefly: { label: "螢火漂移", description: "音符在左右空間隨機閃現", density: 1.05, notes: [0, 4, 7, 11, 14, 19], octave: 1, duration: 0.2, wide: true },
  rain: { label: "數位細雨", description: "高密度、柔和的下降音滴", density: 4.6, notes: [24, 19, 16, 12, 9, 7, 4, 0], octave: 2, duration: 0.045, sequence: true },
  constellation: { label: "星圖序列", description: "規律骨架中加入少量變奏", density: 2.2, notes: [0, 12, 7, 19, 4, 16, 9, 21], octave: 2, duration: 0.1, sequence: true },
  pollen: { label: "花粉布朗運動", description: "音高以相鄰步階游走", density: 2.7, notes: [0, 2, 4, 7, 9, 12, 14, 16], octave: 1, duration: 0.09, walk: true }
};

const base = {
  carrier: 200, beat: 4, swing: 0, swingPeriod: 4, waveform: "sine",
  binauralLevel: 0.6, noise: "off", noiseLevel: 0.08,
  arpeggio: "off", arpeggioLevel: 0.12, arpeggioRoot: 880,
  motionRate: 0, motionDepth: 0, bpm: 80, rhythm: "off", rhythmLevel: 0.1,
  seed: 783
};

export const pages = [
  {
    id: "binaural", step: "01", short: "基礎", title: "純粹差頻",
    summary: "先只保留兩個正弦載波，建立乾淨的聆聽基準。",
    description: "調整基頻、左右差頻與輕微擺盪。適合先熟悉聲音，不加入裝飾層。",
    config: { ...base }, controls: ["carrier", "beat", "swing", "binauralLevel"],
    presets: [
      ["深慢", "200 Hz · 3 Hz", { carrier: 200, beat: 3 }],
      ["舒緩", "136.1 Hz · 4 Hz", { carrier: 136.1, beat: 4 }],
      ["明亮", "432 Hz · 7.83 Hz", { carrier: 432, beat: 7.83 }]
    ]
  },
  {
    id: "noise", step: "02", short: "噪音", title: "頻譜包覆",
    summary: "在差頻外加入可控的白、棕或綠噪音。",
    description: "用低音量噪音建立聲音背景，再比較不同頻譜帶來的包覆感。",
    config: { ...base, beat: 7.83, noise: "brown", noiseLevel: 0.13 }, controls: ["carrier", "beat", "noise", "noiseLevel", "binauralLevel"],
    presets: [
      ["棕色深層", "低頻較多", { noise: "brown", noiseLevel: .16 }],
      ["綠色中域", "集中自然中頻", { noise: "green", noiseLevel: .13 }],
      ["白色聲牆", "平均寬頻", { noise: "white", noiseLevel: .08 }]
    ]
  },
  {
    id: "garden", step: "03", short: "琶音", title: "電子植物園",
    summary: "八種生成式高頻琶音，可調根音、密度與混音比例。",
    description: "每種風格使用可重現的受限亂數，從稀疏點光到密集細雨逐步增加事件密度。",
    config: { ...base, beat: 4, noise: "brown", noiseLevel: .07, arpeggio: "dew", arpeggioLevel: .13 }, controls: ["beat", "arpeggio", "arpeggioRoot", "arpeggioLevel", "noiseLevel"],
    presets: Object.entries(arpeggioStyles).filter(([id]) => id !== "off").map(([id, style]) => [style.label, style.description, { arpeggio: id }])
  },
  {
    id: "motion", step: "04", short: "空間", title: "左右軌道",
    summary: "讓兩個載波在左右耳之間交叉移動。",
    description: "移動速率與差頻彼此獨立；從小幅偏移開始，再逐漸增加到完整互換。",
    config: { ...base, carrier: 200, beat: 3, motionRate: 4, motionDepth: .45, noise: "brown", noiseLevel: .06 }, controls: ["carrier", "beat", "motionRate", "motionDepth", "binauralLevel"],
    presets: [
      ["緩慢漂移", "0.2 次／秒", { motionRate: .2, motionDepth: .55 }],
      ["四拍交叉", "4 次／秒", { motionRate: 4, motionDepth: .6 }],
      ["完全互換", "7 次／秒", { motionRate: 7, motionDepth: 1 }]
    ]
  },
  {
    id: "rhythm", step: "05", short: "節奏", title: "雙耳錯拍",
    summary: "左右耳使用不同分割，形成可調整的複節奏。",
    description: "短提示音依共同小節排列。先保持音量較低，再比較不同比例。",
    config: { ...base, beat: 14, binauralLevel: .45, rhythm: "3:4", bpm: 80, rhythmLevel: .12 }, controls: ["beat", "bpm", "rhythm", "rhythmLevel", "binauralLevel"],
    presets: [
      ["三對四", "穩定入門", { rhythm: "3:4", bpm: 80 }],
      ["四對七", "交錯密度提高", { rhythm: "4:7", bpm: 80 }],
      ["五對七", "高密度錯拍", { rhythm: "5:7", bpm: 120 }]
    ]
  },
  {
    id: "mixer", step: "06", short: "混音", title: "完整混音室",
    summary: "同時控制差頻、噪音、琶音、移動與錯拍。",
    description: "所有聲層集中在同一頁。使用預設作為起點，再細調每層比例。",
    config: { ...base, carrier: 432, beat: 7.83, swing: 1, noise: "green", noiseLevel: .08, arpeggio: "firefly", arpeggioLevel: .1, motionRate: .25, motionDepth: .4, rhythm: "3:4", rhythmLevel: .06 },
    controls: ["carrier", "beat", "swing", "waveform", "binauralLevel", "noise", "noiseLevel", "arpeggio", "arpeggioRoot", "arpeggioLevel", "motionRate", "motionDepth", "bpm", "rhythm", "rhythmLevel"],
    presets: [
      ["安靜森林", "棕噪 · 晨露 · 慢移", { carrier: 136.1, beat: 4, noise: "brown", noiseLevel: .1, arpeggio: "dew", motionRate: .12, motionDepth: .35, rhythm: "off" }],
      ["專注溫室", "綠噪 · 星圖 · 80 BPM", { carrier: 200, beat: 14, noise: "green", arpeggio: "constellation", bpm: 80, rhythm: "3:4", motionRate: 0 }],
      ["清醒軌道", "432 Hz · 晶體 · 快速移動", { carrier: 432, beat: 18, waveform: "square", noise: "off", arpeggio: "crystal", motionRate: 4, motionDepth: .55, rhythm: "4:7", bpm: 120 }]
    ]
  }
];

pages.push({ id: 'perform', step: '07', short: '演奏', title: '聲卡演奏台', summary: '四個基底聲卡槽、迷你鍵盤與 90 秒操作錄製。', config: { ...base } });
export const getPage = (id) => pages.find((page) => page.id === id) || pages[0];
