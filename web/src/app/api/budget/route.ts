import { NextResponse } from 'next/server'
import { getMonthlyBudget } from '@/lib/feed'

export async function GET() {
  try {
    const budget = await getMonthlyBudget()
    return NextResponse.json(budget)
  } catch (error) {
    console.error('Budget API error:', error)
    return NextResponse.json(
      { spentUsd: 0, budgetUsd: 7.3, percent: 0 },
      { status: 200 }
    )
  }
}
