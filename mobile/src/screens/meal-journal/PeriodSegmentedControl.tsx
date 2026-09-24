import React from 'react';
import { Text } from 'react-native';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';

export type JournalPeriod = 'day' | 'week' | 'month' | 'year';

interface PeriodSegmentedControlProps {
  value: JournalPeriod;
  onChange: (period: JournalPeriod) => void;
  className?: string;
  style?: any;
}

const PERIODS: Array<{ id: JournalPeriod; label: string }> = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
];

export function PeriodSegmentedControl({
  value,
  onChange,
  className,
  style,
}: PeriodSegmentedControlProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(val) => onChange(val as JournalPeriod)}
      className={className}
      style={style}
    >
      <TabsList className="h-auto w-full flex-row rounded-full bg-[#EBE5DA] p-1 border-0 shadow-none">
        {PERIODS.map((p) => {
          const isSelected = value === p.id;
          return (
            <TabsTrigger
              key={p.id}
              value={p.id}
              accessibilityLabel={`Chế độ xem theo ${p.label}`}
              className={`flex-1 py-2 rounded-full items-center justify-center border-0 shadow-none ${
                isSelected ? 'bg-primary shadow-xs' : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[14px] ${
                  isSelected
                    ? 'text-primary-foreground font-bold'
                    : 'text-[#78716C] font-semibold'
                }`}
              >
                {p.label}
              </Text>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
