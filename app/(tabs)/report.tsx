import { useState, useContext, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { getDailyLogHistory, getPartnerData } from '../../services/database';

const { UserContext } = require('../_layout');

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getStatus(cal: number, goal: number) {
  if (!cal) return 'missed';
  const r = cal / goal;
  if (r >= 0.95 && r <= 1.1) return 'hit';
  if (r >= 0.85) return 'almost';
  return 'missed';
}

export default function ReportScreen() {
  const ctx = useContext(UserContext);
  const user = ctx?.user;
  const profile = ctx?.profile;

  const [weekData, setWeekData] = useState<any[]>([]);
  const [partnerWeekData, setPartnerWeekData] = useState<any[]>([]);
  const [partner, setPartner] = useState<any>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const goal = profile?.calorieGoal || 2000;

  useEffect(() => {
    if (!user?.uid) return;
    loadWeek();
  }, [user?.uid, weekOffset]);

  const loadWeek = async () => {
    setLoading(true);
    try {
      // Get user's daily logs
      const history = await getDailyLogHistory(user.uid, 60);

      // Get the 7 days for this week
      const days = [];
      const end = new Date();
      end.setDate(end.getDate() - (weekOffset * 7));

      for (let i = 6; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const log = history[dateStr];
        days.push({
          day: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1],
          date: dateStr,
          calories: log?.totalCalories || 0,
          protein: log?.totalProtein || 0,
        });
      }
      setWeekData(days);

      // Load partner data if paired
      if (profile?.partnerId) {
        const pData = await getPartnerData(profile.partnerId);
        setPartner(pData);

        const pHistory = await getDailyLogHistory(profile.partnerId, 60);
        const pDays = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(end);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const log = pHistory[dateStr];
          pDays.push({
            calories: log?.totalCalories || 0,
            protein: log?.totalProtein || 0,
          });
        }
        setPartnerWeekData(pDays);
      }
    } catch (err) {
      console.error('Error loading report:', err);
    }
    setLoading(false);
  };

  // Compute stats
  const daysWithData = weekData.filter(d => d.calories > 0);
  const avgCal = daysWithData.length > 0 ? Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length) : 0;
  const avgProtein = daysWithData.length > 0 ? Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / daysWithData.length) : 0;
  const daysHit = weekData.filter(d => getStatus(d.calories, goal) === 'hit').length;

  // Partner stats
  const pDaysWithData = partnerWeekData.filter(d => d.calories > 0);
  const pAvgCal = pDaysWithData.length > 0 ? Math.round(pDaysWithData.reduce((s, d) => s + d.calories, 0) / pDaysWithData.length) : 0;
  const pAvgProtein = pDaysWithData.length > 0 ? Math.round(pDaysWithData.reduce((s, d) => s + d.protein, 0) / pDaysWithData.length) : 0;
  const pDaysHit = partnerWeekData.filter(d => getStatus(d.calories, partner?.calorieGoal || 1800) === 'hit').length;

  // Bar chart max
  const allCals = weekData.map(d => d.calories);
  const maxCal = Math.max(...allCals, goal) * 1.15 || goal * 1.15;

  // Week label
  const getWeekLabel = () => {
    if (weekOffset === 0) return 'This week';
    const end = new Date();
    end.setDate(end.getDate() - (weekOffset * 7));
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  // Best day
  const bestDay = weekData.reduce((best, d) => {
    if (d.calories === 0) return best;
    const diff = Math.abs(d.calories - goal);
    return diff < best.diff ? { diff, day: d.day, cal: d.calories } : best;
  }, { diff: Infinity, day: '', cal: 0 });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F3' }} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Weekly Report</Text>
        <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{profile?.name}'s stats</Text>
      </View>

      {/* Week selector */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 }}>
        <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)} style={{
          width: 32, height: 32, borderRadius: 8, backgroundColor: 'white',
          borderWidth: 1, borderColor: '#E8E8E6', justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 14, color: '#666' }}>◀</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '600', minWidth: 140, textAlign: 'center' }}>
          {getWeekLabel()}
        </Text>
        <TouchableOpacity onPress={() => { if (weekOffset > 0) setWeekOffset(weekOffset - 1); }}
          disabled={weekOffset === 0}
          style={{
            width: 32, height: 32, borderRadius: 8, backgroundColor: 'white',
            borderWidth: 1, borderColor: '#E8E8E6', justifyContent: 'center', alignItems: 'center',
            opacity: weekOffset === 0 ? 0.3 : 1,
          }}>
          <Text style={{ fontSize: 14, color: '#666' }}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 16 }}>
        {[
          { label: 'Avg cal/day', value: `${avgCal}`, color: '#2D2D2D', icon: '📊' },
          { label: 'Days on target', value: `${daysHit}/7`, color: '#7BA876', icon: '🎯' },
          { label: 'Avg protein', value: `${avgProtein}g`, color: '#D4A45A', icon: '💪' },
        ].map(s => (
          <View key={s.label} style={{
            flex: 1, backgroundColor: 'white', borderRadius: 16, padding: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
          }}>
            <Text style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</Text>
            <Text style={{ fontSize: 24, fontWeight: '700', color: s.color }}>{s.value}</Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Best Day */}
      {bestDay.cal > 0 && (
        <View style={{
          marginHorizontal: 24, marginTop: 16, backgroundColor: '#F0F5EE',
          borderRadius: 14, padding: 14, paddingHorizontal: 18,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          borderWidth: 1, borderColor: '#D8E4D5',
        }}>
          <Text style={{ fontSize: 24 }}>⭐</Text>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600' }}>Best day: {bestDay.day}</Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
              {bestDay.cal} cal — closest to your goal
            </Text>
          </View>
        </View>
      )}

      {/* Bar Chart */}
      <View style={{
        marginHorizontal: 24, marginTop: 16, backgroundColor: 'white',
        borderRadius: 20, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
      }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 16 }}>Daily calories</Text>

        <View style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          {weekData.map((d, i) => {
            const h = maxCal > 0 ? (d.calories / maxCal) * 100 : 0;
            const status = getStatus(d.calories, goal);
            const color = status === 'hit' ? '#7BA876' : status === 'almost' ? '#D4A45A' : d.calories > 0 ? '#D4845A' : '#E8E8E6';
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#999', marginBottom: 4 }}>
                  {d.calories > 0 ? d.calories : ''}
                </Text>
                <View style={{
                  width: '80%', maxWidth: 32, borderTopLeftRadius: 8, borderTopRightRadius: 8,
                  borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
                  backgroundColor: color, height: `${Math.max(h, 3)}%`, minHeight: 4,
                }} />
              </View>
            );
          })}
        </View>

        {/* Day labels */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {weekData.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#999' }}>{d.day}</Text>
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={{
          flexDirection: 'row', justifyContent: 'center', gap: 16,
          marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0EE',
        }}>
          {[{ color: '#7BA876', label: 'On target' }, { color: '#D4A45A', label: 'Almost' }, { color: '#D4845A', label: 'Off' }].map(item => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 4, backgroundColor: item.color }} />
              <Text style={{ fontSize: 11, color: '#999' }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Partner Comparison */}
      {partner && (
        <View style={{
          marginHorizontal: 24, marginTop: 16, backgroundColor: 'white',
          borderRadius: 20, padding: 20,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 16 }}>
            You & your partner
          </Text>

          {/* Names */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 8, backgroundColor: '#7BA876',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>{profile?.name?.charAt(0)}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600' }}>{profile?.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600' }}>{partner?.name}</Text>
              <View style={{
                width: 28, height: 28, borderRadius: 8, backgroundColor: '#8BA4D4',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>{partner?.name?.charAt(0)}</Text>
              </View>
            </View>
          </View>

          {/* Comparison rows */}
          {[
            { label: 'Avg daily cal', u: avgCal, p: pAvgCal, fmt: (v: number) => `${v}` },
            { label: 'Days on target', u: daysHit, p: pDaysHit, fmt: (v: number) => `${v}/7` },
            { label: 'Avg protein', u: avgProtein, p: pAvgProtein, fmt: (v: number) => `${v}g` },
          ].map((row, i) => (
            <View key={row.label} style={{
              flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
              borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#F0F0EE',
            }}>
              <Text style={{
                flex: 1, fontSize: 16, fontWeight: '700',
                color: row.u >= row.p && row.u > 0 ? '#7BA876' : '#2D2D2D',
              }}>{row.fmt(row.u)}</Text>
              <View style={{
                backgroundColor: '#F5F5F3', paddingHorizontal: 10, paddingVertical: 4,
                borderRadius: 6, minWidth: 100, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 12, color: '#999', fontWeight: '500' }}>{row.label}</Text>
              </View>
              <Text style={{
                flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'right',
                color: row.p > row.u && row.p > 0 ? '#8BA4D4' : '#2D2D2D',
              }}>{row.fmt(row.p)}</Text>
            </View>
          ))}

          <Text style={{
            fontSize: 11, color: '#CCC', textAlign: 'center',
            fontStyle: 'italic', marginTop: 12,
          }}>Not a competition — you're on the same team 💪</Text>
        </View>
      )}

      {loading && (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: '#999' }}>Loading report...</Text>
        </View>
      )}
    </ScrollView>
  );
}