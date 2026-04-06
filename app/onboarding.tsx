import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, FlatList, Animated } from 'react-native';

const { width } = Dimensions.get('window');

interface OnboardingProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    emoji: '🥗',
    title: 'Welcome to NutriPair',
    subtitle: 'Track your nutrition together with your partner and keep each other accountable.',
    color: '#7BA876',
  },
  {
    emoji: '📊',
    title: 'Track your meals',
    subtitle: 'Log food with our database of millions of items, scan barcodes, or create custom foods.',
    color: '#D4A45A',
  },
  {
    emoji: '👥',
    title: 'Partner up',
    subtitle: 'Pair with your partner to see each other\'s progress in real-time and send encouraging nudges.',
    color: '#8BA4D4',
  },
  {
    emoji: '🎯',
    title: 'Hit your goals',
    subtitle: 'Our BMR calculator sets personalized calorie and macro targets based on your body and goals.',
    color: '#D4845A',
  },
  {
    emoji: '🔥',
    title: 'Build streaks',
    subtitle: 'Stay consistent and watch your streak grow. Your check-in is auto-tracked from your meals.',
    color: '#F0A050',
  },
  {
    emoji: '🧮',
    title: "Let's set your goals",
    subtitle: "We'll calculate your ideal calories and macros based on your body, activity level, and goals.",
    color: '#7BA876',
  },
];

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={{ width, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
      <View style={{
        width: 120, height: 120, borderRadius: 36,
        backgroundColor: `${item.color}15`, justifyContent: 'center',
        alignItems: 'center', marginBottom: 32,
      }}>
        <Text style={{ fontSize: 56 }}>{item.emoji}</Text>
      </View>
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#2D2D2D', textAlign: 'center', marginBottom: 12 }}>
        {item.title}
      </Text>
      <Text style={{ fontSize: 16, color: '#999', textAlign: 'center', lineHeight: 24 }}>
        {item.subtitle}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
      {/* Skip button */}
      <View style={{ paddingTop: 56, paddingHorizontal: 24, alignItems: 'flex-end' }}>
        {!isLast && (
          <TouchableOpacity onPress={handleSkip} style={{ padding: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#999' }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(_, i) => String(i)}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        style={{ flex: 1 }}
      />

      {/* Bottom section */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        {/* Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {SLIDES.map((slide, i) => {
            const isActive = i === currentIndex;
            return (
              <View key={i} style={{
                width: isActive ? 24 : 8, height: 8, borderRadius: 4,
                backgroundColor: isActive ? slide.color : '#E0DED9',
              }} />
            );
          })}
        </View>

        {/* Button */}
        <TouchableOpacity onPress={handleNext} style={{
          backgroundColor: SLIDES[currentIndex].color, padding: 16,
          borderRadius: 14, alignItems: 'center',
          shadowColor: SLIDES[currentIndex].color,
          shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
        }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
            {isLast ? "Let's get started!" : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}