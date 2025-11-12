"use client"; // 添加这行，标记为客户端组件
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function Home() {
  const [data, setData] = useState<object[]>([])

  useEffect(() => {
    // 假设你的 Supabase 中有一个 'test' 表
    const fetchTestData = async () => {
      // 仅查询，不携带任何 data/body
      const { data: testData, error } = await supabase
        .from('test')
        .select('*'); // 纯查询，无需其他数据参数

      if (error) {
        console.error('查询错误:', error);
        return;
      }
      setData(testData);
    };
    fetchTestData()
  }, [])

  return (
    <main>
      <h1>Supabase + Next.js 测试</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  )
}