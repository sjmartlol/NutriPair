import { useState, useContext, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getDailyLogHistory, calculateStreak } from '../../services/database';

const { UserContext } = require('../_layout');

const MILESTONES = [
  { days: 7, label: '1 Week', emoji: '⭐' },
  { days: 14, label: '2 Weeks', emoji: '🌟' },
  { days: 30, label: '1 Month', emoji: '🔥' },
  { days: 60, label: '2 Months', emoji: '💎' },
  { days: 100, label: '100 Days', emoji: '🏆' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getStatus(cal: number, goal: number) {
  if (!cal) return 'missed';
  const r = cal / goal;
  if (r >= 0.95 && r <= 1.1) return 'yes';
  if (r >= 0.85) return 'almost';
  return 'no';
}

function MiniRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 100;
  const sw = 6;
  const r = (size / 2) - sw;
  const c = 2 * Math.PI * r;
  const pct = Math.min((consumed / goal) * 100, 100);
  const offset = c - (pct / 100) * c;
  const status = getStatus(consumed, goal);
  const color = status === 'yes' ? '#7BA876' : status === 'almost' ? '#D4A45A' : '#D4845A';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E8E6" strokeWidth={sw} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={offset}
          rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#2D2D2D' }}>{consumed}</Text>
        <Text style={{ fontSize: 9, color: '#999' }}>/ {goal} cal</Text>
      </View>
    </View>
  );
}

export default function CheckInScreen() {
  const ctx = useContext(UserContext);
  const profile = ctx?.profile;
  const todayLog = ctx?.todayLog;
  const user = ctx?.user;

  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<Record<string, any>>({});
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [weekData, setWeekData] = useState<any[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);

  const consumed = todayLog?.totalCalories || 0;
  const goal = profile?.calorieGoal || 2000;
  const todayStatus = getStatus(consumed, goal);
  const pctText = Math.round((consumed / goal) * 100);

  useEffect(() => {
    if (!user?.uid || !profile?.calorieGoal) return;
    (async () => {
      const logs = await getDailyLogHistory(user.uid, 45);
      setHistory(logs);
      const s = calculateStreak(logs, profile.calorieGoal);
      setStreak(s);
    })();
  }, [user?.uid, todayLog]);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const history = await getDailyLogHistory(user.uid, 60);
      const days = [];
      const end = new Date();
      end.setDate(end.getDate() - (weekOffset * 7));

      for (let i = 6; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const log = history[dateStr];
        days.push({
          day: WEEKDAYS[d.getDay()],
          calories: log?.totalCalories || 0,
          protein: log?.totalProtein || 0,
        });
      }
      setWeekData(days);
    })();
  }, [user?.uid, weekOffset, todayLog]);

  const statusConfig: Record<string, any> = {
    yes: { emoji: '🎯', title: 'Goal hit!', subtitle: 'You nailed it today', bg: '#F0F5EE', border: '#D8E4D5' },
    almost: { emoji: '🤏', title: 'Almost there!', subtitle: 'So close — keep it up', bg: '#FFF8F0', border: '#F0E6DA' },
    no: { emoji: '😅', title: 'Keep going!', subtitle: "You've still got time today", bg: '#FFF5F3', border: '#F0DAD5' },
    missed: { emoji: '📝', title: 'Start logging!', subtitle: 'Log meals to track your goal', bg: 'white', border: '#E8E8E6' },
  };
  const cfg = statusConfig[todayStatus];

  // Calendar
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getDateStatus = (day: number) => {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (ds === todayStr) return 'today';
    if (new Date(viewYear, viewMonth, day) > today) return 'future';
    const log = history[ds];
    if (!log) return 'missed';
    return getStatus(log.totalCalories, goal);
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    yes: { bg: '#7BA876', text: 'white' },
    almost: { bg: '#F0D48A', text: '#2D2D2D' },
    no: { bg: '#E8C4B8', text: '#2D2D2D' },
    missed: { bg: 'transparent', text: '#CCC' },
    today: { bg: '#2D2D2D', text: 'white' },
    future: { bg: 'transparent', text: '#E0DED9' },
  };

  const handlePrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const handleNext = () => {
    if (viewMonth === today.getMonth() && viewYear === today.getFullYear()) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  // Stats
  const allLogs = Object.values(history) as any[];
  const yesCount = allLogs.filter(l => getStatus(l.totalCalories, goal) === 'yes').length;
  const almostCount = allLogs.filter(l => getStatus(l.totalCalories, goal) === 'almost').length;
  const totalDays = allLogs.length;
  const hitRate = totalDays > 0 ? Math.round(((yesCount + almostCount) / totalDays) * 100) : 0;
  const daysWithWeekData = weekData.filter(d => d.calories > 0);
  const avgCal = daysWithWeekData.length > 0 ? Math.round(daysWithWeekData.reduce((s, d) => s + d.calories, 0) / daysWithWeekData.length) : 0;
  const avgProtein = daysWithWeekData.length > 0 ? Math.round(daysWithWeekData.reduce((s, d) => s + d.protein, 0) / daysWithWeekData.length) : 0;
  const daysHit = weekData.filter(d => getStatus(d.calories, goal) === 'yes').length;
  const maxCal = Math.max(...weekData.map(d => d.calories), goal) * 1.15 || goal * 1.15;

  const getWeekLabel = () => {
    if (weekOffset === 0) return 'This week';
    const end = new Date();
    end.setDate(end.getDate() - (weekOffset * 7));
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F3' }} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Daily Check-In</Text>
        <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{profile?.name}'s progress</Text>
      </View>

      {/* Today's Status Card */}
      <View style={{
        marginHorizontal: 24, marginTop: 16, backgroundColor: cfg.bg,
        borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: cfg.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <MiniRing consumed={consumed} goal={goal} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 24 }}>{cfg.emoji}</Text>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>{cfg.title}</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>{cfg.subtitle}</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: `${todayStatus === 'yes' ? '#7BA876' : todayStatus === 'almost' ? '#D4A45A' : '#D4845A'}15`,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start',
            }}>
              <View style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: todayStatus === 'yes' ? '#7BA876' : todayStatus === 'almost' ? '#D4A45A' : '#D4845A',
              }} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666' }}>{pctText}% of daily goal</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Streak */}
      <View style={{
        marginHorizontal: 24, marginTop: 16, borderRadius: 20, padding: 24,
        borderWidth: 1, borderColor: '#F0E6DA', alignItems: 'center',
        backgroundColor: '#FFF8F0',
      }}>
        <Text style={{ fontSize: 48 }}>🔥</Text>
        <Text style={{ fontSize: 36, fontWeight: '700', marginTop: 4 }}>{streak}</Text>
        <Text style={{ fontSize: 14, color: '#999', marginTop: 2 }}>day streak</Text>
        <Text style={{ fontSize: 11, color: '#C0B8A8', marginTop: 8 }}>Auto-tracked from your meal logs</Text>
      </View>

      {/* Milestones */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 12 }}>Milestones</Text>
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'white',
          borderRadius: 16, padding: 16,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        }}>
          {MILESTONES.map(m => (
            <View key={m.days} style={{ alignItems: 'center', gap: 6, opacity: streak >= m.days ? 1 : 0.35 }}>
              <View style={{
                width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
                backgroundColor: streak >= m.days ? '#F0A050' : '#E8E8E6',
              }}>
                <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: streak >= m.days ? '#2D2D2D' : '#999' }}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Calendar */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 12 }}>History</Text>
        <View style={{
          backgroundColor: 'white', borderRadius: 20, padding: 20,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        }}>
          {/* Month nav */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text onPress={handlePrev} style={{ fontSize: 18, padding: 6 }}>◀</Text>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{MONTHS[viewMonth]} {viewYear}</Text>
            <Text onPress={handleNext} style={{ fontSize: 18, padding: 6, opacity: viewMonth === today.getMonth() && viewYear === today.getFullYear() ? 0.3 : 1 }}>▶</Text>
          </View>

          {/* Weekday headers */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {WEEKDAYS.map(d => (
              <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Days grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
              const status = getDateStatus(day);
              const colors = statusColors[status];
              return (
                <View key={day} style={{
                  width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center',
                }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 10,
                    backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: status === 'today' ? '700' : '500', color: colors.text }}>
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0EE' }}>
            {[{ color: '#7BA876', label: 'Hit' }, { color: '#F0D48A', label: 'Almost' }, { color: '#E8C4B8', label: 'Missed' }].map(item => (
              <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 4, backgroundColor: item.color }} />
                <Text style={{ fontSize: 11, color: '#999' }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 16 }}>
        {[
          { label: 'Goal hit', value: `${yesCount}`, color: '#7BA876' },
          { label: 'Almost', value: `${almostCount}`, color: '#D4A45A' },
          { label: 'Hit rate', value: `${hitRate}%`, color: '#2D2D2D' },
        ].map(stat => (
          <View key={stat.label} style={{
            flex: 1, backgroundColor: 'white', borderRadius: 14, padding: 16, alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
          }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: stat.color }}>{stat.value}</Text>
            <Text style={{ fontSize: 11, color: '#999', fontWeight: '600', marginTop: 4 }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Weekly report (merged from Report tab) */}
      <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>Weekly Report</Text>
        <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>Your nutrition trends</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 14 }}>
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

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 14 }}>
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
            const color = status === 'yes' ? '#7BA876' : status === 'almost' ? '#D4A45A' : d.calories > 0 ? '#D4845A' : '#E8E8E6';
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

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {weekData.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#999' }}>{d.day}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}