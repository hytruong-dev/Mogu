import React from 'react';
import { View, Text } from 'react-native';
import { Utensils } from 'lucide-react-native';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';

interface ThumbnailStackProps {
  urls: string[];
  maxCount?: number;
  size?: number;
  className?: string;
}

export function ThumbnailStack({
  urls = [],
  maxCount = 3,
  size = 32,
  className = '',
}: ThumbnailStackProps) {
  const visibleUrls = urls.filter(Boolean).slice(0, maxCount);
  const remaining = Math.max(0, urls.length - maxCount);

  if (visibleUrls.length === 0) {
    return (
      <Avatar
        style={{ width: size, height: size }}
        className={`bg-[#F5F2EB] border border-[#E7DFD3] ${className}`}
      >
        <AvatarFallback className="bg-transparent items-center justify-center">
          <Utensils size={size * 0.45} color="#A8A29E" />
        </AvatarFallback>
      </Avatar>
    );
  }

  const overlap = size * 0.35;

  return (
    <View className={`flex-row items-center ${className}`}>
      {visibleUrls.map((url, index) => (
        <Avatar
          key={`${url}-${index}`}
          style={{
            width: size,
            height: size,
            marginLeft: index === 0 ? 0 : -overlap,
            zIndex: visibleUrls.length - index,
          }}
          className="border-2 border-white bg-[#E7DFD3] shadow-xs"
        >
          <AvatarImage source={{ uri: url }} />
          <AvatarFallback className="bg-[#FAF7F2] items-center justify-center">
            <Utensils size={size * 0.4} color="#A8A29E" />
          </AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: -overlap,
            zIndex: 0,
          }}
          className="border-2 border-white bg-primary/20 items-center justify-center"
        >
          <Text className="text-[10px] font-bold text-foreground">
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}
