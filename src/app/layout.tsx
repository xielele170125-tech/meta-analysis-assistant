import type { Metadata } from 'next';
import './globals.css';
import { PaymentWrapper } from '@/components/PaymentWrapper';
import { I18nProvider } from '@/lib/i18n/context';

export const metadata: Metadata = {
  title: {
    default: 'Meta分析助手 | 扣子编程',
    template: '%s | 扣子编程',
  },
  description:
    '文献Meta分析智能体，支持文献数据提取、Meta分析和森林图可视化。',
  keywords: [
    'Meta分析',
    '文献分析',
    '系统评价',
    '森林图',
    '漏斗图',
    'DeepSeek',
    '扣子编程',
  ],
  authors: [{ name: 'Coze Code Team', url: 'https://code.coze.cn' }],
  generator: 'Coze Code',
  openGraph: {
    title: 'Meta分析助手 | 扣子编程',
    description:
      '基于DeepSeek的文献Meta分析智能体，支持AI自动提取数据和可视化分析。',
    url: 'https://code.coze.cn',
    siteName: '扣子编程',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className="antialiased">
        <I18nProvider>
          <PaymentWrapper>
            {children}
          </PaymentWrapper>
        </I18nProvider>
      </body>
    </html>
  );
}
