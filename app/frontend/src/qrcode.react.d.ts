declare module 'qrcode.react' {
  import { Component } from 'react'
  
  interface QRCodeProps {
    value: string
    size?: number
    bgColor?: string
    fgColor?: string
    level?: string
    includeMargin?: boolean
    renderAs?: 'canvas' | 'svg'
    imageSettings?: {
      src: string
      x?: number
      y?: number
      height?: number
      width?: number
    }
  }

  class QRCode extends Component<QRCodeProps> {}
  export default QRCode
}
