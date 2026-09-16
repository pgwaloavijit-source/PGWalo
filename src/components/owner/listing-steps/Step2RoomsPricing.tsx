import React, { useState, useEffect } from 'react';
import { Plus, Minus, Building2, Bed, DollarSign, Copy, Trash2 } from 'lucide-react';
import { OwnerListingStep2, RoomDetail, BedDetail, RoomType, SharingCapacity, BedStatus } from '../../../types';

interface Step2RoomsPricingProps {
  data: OwnerListingStep2;
  onDataChange: (data: OwnerListingStep2) => void;
  onValidationChange: (isValid: boolean) => void;
}

const ROOM_TYPES: RoomType[] = ['Private', 'Shared', 'Dormitory'];
const SHARING_OPTIONS: SharingCapacity[] = ['Single', 'Double', 'Triple', '4 Sharing', '5+ Sharing'];
const FLOORS = ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor+'];

const Step2RoomsPricing: React.FC<Step2RoomsPricingProps> = ({ data, onDataChange, onValidationChange }) => {
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({
    startRoom: '',
    endRoom: '',
    roomType: 'Shared' as RoomType,
    sharingCapacity: 'Double' as SharingCapacity,
    bedsPerRoom: 2,
    rentPerBed: 8000,
    depositPerBed: 8000,
  });

  const validate = () => {
    const isValid = data.rooms.length > 0 && data.rooms.every(room => 
      room.roomNumber.trim() !== '' &&
      room.numberOfBeds > 0 &&
      room.beds.length === room.numberOfBeds &&
      room.beds.every(bed => bed.monthlyRent > 0 && bed.securityDeposit >= 0)
    );
    onValidationChange(isValid);
    return isValid;
  };

  useEffect(() => {
    validate();
  }, [data]);

  const addRoom = () => {
    const newRoom: RoomDetail = {
      roomNumber: '',
      floor: '1st Floor',
      roomType: 'Shared',
      sharingCapacity: 'Double',
      numberOfBeds: 2,
      beds: createBeds(2, 'Double'),
    };
    onDataChange({ ...data, rooms: [...data.rooms, newRoom] });
  };

  const removeRoom = (index: number) => {
    const updatedRooms = data.rooms.filter((_, i) => i !== index);
    onDataChange({ ...data, rooms: updatedRooms });
  };

  const updateRoom = (index: number, field: keyof RoomDetail, value: any) => {
    const updatedRooms = [...data.rooms];
    updatedRooms[index] = { ...updatedRooms[index], [field]: value };

    // Update beds when sharing capacity or number of beds changes
    if (field === 'sharingCapacity' || field === 'numberOfBeds') {
      updatedRooms[index].beds = createBeds(
        updatedRooms[index].numberOfBeds,
        updatedRooms[index].sharingCapacity,
        updatedRooms[index].beds
      );
    }

    onDataChange({ ...data, rooms: updatedRooms });
  };

  const updateBed = (roomIndex: number, bedIndex: number, field: keyof BedDetail, value: any) => {
    const updatedRooms = [...data.rooms];
    updatedRooms[roomIndex].beds[bedIndex] = {
      ...updatedRooms[roomIndex].beds[bedIndex],
      [field]: value,
    };
    onDataChange({ ...data, rooms: updatedRooms });
  };

  const createBeds = (count: number, sharing: SharingCapacity, existingBeds?: BedDetail[]): BedDetail[] => {
    const bedNames = sharing === 'Single' ? ['Single'] : ['A', 'B', 'C', 'D', 'E'];
    return Array.from({ length: count }, (_, i) => {
      const existingBed = existingBeds?.[i];
      return {
        bedId: existingBed?.bedId || `bed-${Date.now()}-${i}`,
        bedName: existingBed?.bedName || `Bed ${bedNames[i] || i + 1}`,
        status: existingBed?.status || 'Available',
        monthlyRent: existingBed?.monthlyRent || 8000,
        securityDeposit: existingBed?.securityDeposit || 8000,
        oneTimeCharges: existingBed?.oneTimeCharges || 0,
      };
    });
  };

  const handleBulkCreate = () => {
    const startNum = parseInt(bulkConfig.startRoom);
    const endNum = parseInt(bulkConfig.endRoom);

    if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
      alert('Please enter valid room numbers');
      return;
    }

    const newRooms: RoomDetail[] = [];
    for (let i = startNum; i <= endNum; i++) {
      newRooms.push({
        roomNumber: i.toString(),
        floor: '1st Floor',
        roomType: bulkConfig.roomType,
        sharingCapacity: bulkConfig.sharingCapacity,
        numberOfBeds: bulkConfig.bedsPerRoom,
        beds: createBeds(bulkConfig.bedsPerRoom, bulkConfig.sharingCapacity).map(bed => ({
          ...bed,
          monthlyRent: bulkConfig.rentPerBed,
          securityDeposit: bulkConfig.depositPerBed,
        })),
      });
    }

    onDataChange({ ...data, rooms: [...data.rooms, ...newRooms] });
    setShowBulkCreate(false);
    setBulkConfig({
      startRoom: '',
      endRoom: '',
      roomType: 'Shared',
      sharingCapacity: 'Double',
      bedsPerRoom: 2,
      rentPerBed: 8000,
      depositPerBed: 8000,
    });
  };

  const copyRoom = (index: number) => {
    const roomToCopy = data.rooms[index];
    const newRoom: RoomDetail = {
      ...roomToCopy,
      roomNumber: `${roomToCopy.roomNumber} (Copy)`,
      beds: roomToCopy.beds.map(bed => ({
        ...bed,
        bedId: `bed-${Date.now()}-${Math.random()}`,
      })),
    };
    onDataChange({ ...data, rooms: [...data.rooms, newRoom] });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Rooms & Pricing</h2>
        <p className="text-slate-600">Add your rooms and beds with pricing details. This is your core inventory.</p>
      </div>

      {/* Bulk Create Section */}
      <div className="mb-6">
        {!showBulkCreate ? (
          <button
            onClick={() => setShowBulkCreate(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-200"
          >
            <Copy className="w-5 h-5" />
            Create Multiple Rooms
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-blue-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Bulk Room Creation</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Room</label>
                <input
                  type="text"
                  value={bulkConfig.startRoom}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, startRoom: e.target.value })}
                  placeholder="101"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Room</label>
                <input
                  type="text"
                  value={bulkConfig.endRoom}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, endRoom: e.target.value })}
                  placeholder="110"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room Type</label>
                <select
                  value={bulkConfig.roomType}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, roomType: e.target.value as RoomType })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {ROOM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sharing</label>
                <select
                  value={bulkConfig.sharingCapacity}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, sharingCapacity: e.target.value as SharingCapacity })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {SHARING_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Beds/Room</label>
                <input
                  type="number"
                  value={bulkConfig.bedsPerRoom}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, bedsPerRoom: parseInt(e.target.value) || 2 })}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rent/Bed (₹)</label>
                <input
                  type="number"
                  value={bulkConfig.rentPerBed}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, rentPerBed: parseInt(e.target.value) || 8000 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deposit/Bed (₹)</label>
                <input
                  type="number"
                  value={bulkConfig.depositPerBed}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, depositPerBed: parseInt(e.target.value) || 8000 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleBulkCreate}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                  Create Rooms
                </button>
                <button
                  onClick={() => setShowBulkCreate(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Single Room Button */}
      <div className="mb-6">
        <button
          onClick={addRoom}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 font-medium hover:bg-blue-50 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Room
        </button>
      </div>

      {/* Rooms List */}
      <div className="space-y-4">
        {data.rooms.map((room, roomIndex) => (
          <div key={roomIndex} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Room {room.roomNumber || 'New Room'}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyRoom(roomIndex)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Copy Room"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeRoom(roomIndex)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  title="Remove Room"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room Number *</label>
                <input
                  type="text"
                  value={room.roomNumber}
                  onChange={(e) => updateRoom(roomIndex, 'roomNumber', e.target.value)}
                  placeholder="101"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Floor</label>
                <select
                  value={room.floor}
                  onChange={(e) => updateRoom(roomIndex, 'floor', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {FLOORS.map(floor => <option key={floor} value={floor}>{floor}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room Type</label>
                <select
                  value={room.roomType}
                  onChange={(e) => updateRoom(roomIndex, 'roomType', e.target.value as RoomType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {ROOM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sharing Capacity</label>
                <select
                  value={room.sharingCapacity}
                  onChange={(e) => updateRoom(roomIndex, 'sharingCapacity', e.target.value as SharingCapacity)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {SHARING_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Number of Beds *</label>
              <input
                type="number"
                value={room.numberOfBeds}
                onChange={(e) => updateRoom(roomIndex, 'numberOfBeds', parseInt(e.target.value) || 1)}
                min="1"
                className="w-full md:w-1/4 px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Beds Section */}
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Bed className="w-4 h-4" />
                Bed Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {room.beds.map((bed, bedIndex) => (
                  <div key={bedIndex} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-slate-900">{bed.bedName}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        bed.status === 'Available' ? 'bg-green-100 text-green-700' :
                        bed.status === 'Occupied' ? 'bg-red-100 text-red-700' :
                        bed.status === 'Reserved' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {bed.status}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-400" />
                        <div className="flex-1">
                          <label className="text-xs text-slate-600">Monthly Rent (₹)</label>
                          <input
                            type="number"
                            value={bed.monthlyRent}
                            onChange={(e) => updateBed(roomIndex, bedIndex, 'monthlyRent', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-400" />
                        <div className="flex-1">
                          <label className="text-xs text-slate-600">Security Deposit (₹)</label>
                          <input
                            type="number"
                            value={bed.securityDeposit}
                            onChange={(e) => updateBed(roomIndex, bedIndex, 'securityDeposit', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.rooms.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No rooms added yet</p>
          <p className="text-slate-500 text-sm mt-1">Add your first room to get started</p>
        </div>
      )}
    </div>
  );
};

export default Step2RoomsPricing;