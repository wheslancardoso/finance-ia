import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Tag, X, Trash2 } from 'lucide-react-native';
import { useCategories, Category } from '../src/hooks/useCategories';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';

export default function CategoriesPage() {
  const router = useRouter();
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  if (loading && categories.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#050505]">
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-white/5">
        <Pressable 
          onPress={() => router.back()}
          className="p-2 -ml-2"
        >
          <ArrowLeft color="#fff" size={24} />
        </Pressable>
        <Text className="text-white font-bold text-lg uppercase tracking-widest">Categorias</Text>
        <Pressable 
          onPress={() => setShowAddModal(true)}
          className="p-2 -mr-2 bg-emerald-500/10 rounded-full"
        >
          <Plus color="#10b981" size={20} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-6">Suas Classificações</Text>
        
        {categories.map((cat) => (
          <Pressable 
            key={cat.id}
            onPress={() => setSelectedCategory(cat)}
            className="flex-row items-center justify-between p-5 bg-white/5 border border-white/10 rounded-[24px] mb-4"
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-violet-600/20 items-center justify-center mr-4 border border-violet-600/30">
                <Tag size={18} color="#8b5cf6" />
              </View>
              <Text className="text-white font-bold text-base">{cat.name}</Text>
            </View>
            <View className="w-2 h-2 rounded-full bg-white/10" />
          </Pressable>
        ))}

        {categories.length === 0 && (
          <View className="py-20 items-center justify-center">
            <Tag size={40} color="rgba(255,255,255,0.05)" />
            <Text className="text-white/20 mt-4 italic text-center">Nenhuma categoria personalizada</Text>
          </View>
        )}
        
        <View className="h-20" />
      </ScrollView>

      {(showAddModal || selectedCategory) && (
        <CategoryFormModal 
          category={selectedCategory}
          onClose={() => {
            setShowAddModal(false);
            setSelectedCategory(null);
          }}
          onSave={async (name: string) => {
             if (selectedCategory) {
               await updateCategory(selectedCategory.id, { name });
             } else {
               await createCategory({ name, color: '#8b5cf6' });
             }
             setShowAddModal(false);
             setSelectedCategory(null);
          }}
          onDelete={async () => {
             if (selectedCategory) {
               await deleteCategory(selectedCategory.id);
               setSelectedCategory(null);
             }
          }}
        />
      )}
    </SafeAreaView>
  );
}

function CategoryFormModal({ category, onClose, onSave, onDelete }: any) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%'], []);
  const [name, setName] = useState(category?.name || '');
  const [saving, setSaving] = useState(false);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.5} />
    ),
    []
  );

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    try {
      await onSave(name);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      bottomSheetRef.current?.close();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#0a0a0a' }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
    >
      <View style={styles.modalContent}>
        <View className="flex-row justify-between items-center mb-8">
          <Text className="text-white text-xl font-black uppercase tracking-widest">
            {category ? 'Editar Categoria' : 'Nova Categoria'}
          </Text>
          <Pressable onPress={() => bottomSheetRef.current?.close()}>
            <X color="#fff" size={24} />
          </Pressable>
        </View>

        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Nome</Text>
          <TextInput
            className="bg-white/5 border border-white/10 rounded-[24px] px-5 py-5 text-white text-base font-bold"
            placeholder="Ex: Lazer, Saúde, Pets..."
            placeholderTextColor="rgba(255,255,255,0.15)"
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        <View className="flex-row gap-4">
          {category && (
            <Pressable 
              onPress={() => {
                onDelete();
                bottomSheetRef.current?.close();
              }}
              className="flex-1 py-6 rounded-[32px] bg-rose-500/10 border border-rose-500/20 items-center"
            >
              <Trash2 color="#f43f5e" size={20} />
            </Pressable>
          )}
          <Pressable 
            onPress={handleSave}
            disabled={saving}
            className="flex-[3] py-6 rounded-[32px] bg-violet-600 items-center shadow-xl shadow-violet-600/20"
          >
            <Text className="text-white font-black uppercase tracking-widest">
              {saving ? 'Salvando...' : 'Confirmar'}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  }
});
