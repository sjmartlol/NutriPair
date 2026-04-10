import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

function OptionCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1.5,
        borderColor: '#E0DED9',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: '#F5F5F3',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#2D2D2D' }}>{title}</Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 3 }}>{subtitle}</Text>
      </View>
      <Text style={{ color: '#CCC', fontSize: 18 }}>→</Text>
    </TouchableOpacity>
  );
}

export default function LogMealChooserScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Log a meal</Text>
        <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
          Choose how you want to add food.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 18, gap: 10 }}>
        <OptionCard
          title="Custom Foods"
          subtitle="Pick from foods you’ve saved"
          icon="⭐"
          onPress={() => router.push({ pathname: '/my-foods', params: { mode: 'custom' } })}
        />
        <OptionCard
          title="Scan your food"
          subtitle="Scan a barcode or use AI"
          icon="📷"
          onPress={() => router.push('/scan-food')}
        />
        <OptionCard
          title="Search Foods"
          subtitle="Search thousands of foods"
          icon="🔎"
          onPress={() => router.push({ pathname: '/my-foods', params: { mode: 'database' } })}
        />
        <OptionCard
          title="Create new meal"
          subtitle="Add a food manually"
          icon="＋"
          onPress={() => router.push({ pathname: '/my-foods', params: { mode: 'create' } })}
        />
      </View>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          marginTop: 16,
          marginHorizontal: 24,
          padding: 14,
          borderRadius: 12,
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: '#E0DED9',
          backgroundColor: 'white',
        }}
      >
        <Text style={{ color: '#999', fontWeight: '600' }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

