import React from 'react';
import { View } from 'react-native';
import { Skeleton as MotiSkeleton } from 'moti/skeleton';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | 'round';
  show?: boolean;
  className?: string;
}

export default function Skeleton({ width, height, radius = 16, show = true, className }: SkeletonProps) {
  return (
    <View className={className}>
      <MotiSkeleton
        show={show}
        width={width as any}
        height={height as any}
        radius={radius === 'round' ? 'round' : radius}
        colorMode="dark"
        backgroundColor="rgba(255,255,255,0.05)"
        transition={{
          type: 'timing',
          duration: 1500,
        }}
      />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View className="space-y-6">
      {/* Month Navigator Skeleton */}
      <View className="flex-row items-center justify-between mb-4">
         <Skeleton width={40} height={40} radius={12} />
         <Skeleton width={150} height={24} radius={8} />
         <Skeleton width={40} height={40} radius={12} />
      </View>

      {/* Liquidity Card Skeleton */}
      <Skeleton width="100%" height={180} radius={32} />

      {/* Stats Grid Skeleton */}
      <View className="flex-row gap-4 mb-10">
        <Skeleton width="48%" height={100} radius={32} />
        <Skeleton width="48%" height={100} radius={32} />
      </View>

      {/* Goals Skeleton */}
      <View className="flex-row gap-4">
        <Skeleton width={280} height={180} radius={32} />
        <Skeleton width={280} height={180} radius={32} />
      </View>
    </View>
  );
}

export function TransactionSkeleton() {
  return (
    <View className="flex-row items-center justify-between p-4 mb-3 bg-white/[0.02] border border-white/5 rounded-[28px]">
      <View className="flex-row items-center">
        <Skeleton width={48} height={48} radius={16} />
        <View className="ml-4 space-y-2">
          <Skeleton width={120} height={16} radius={4} />
          <Skeleton width={80} height={12} radius={4} />
        </View>
      </View>
      <View className="items-end space-y-2">
        <Skeleton width={60} height={20} radius={4} />
        <Skeleton width={40} height={10} radius={4} />
      </View>
    </View>
  );
}
