import { matchesPlaceQuery } from '../src/utils/locationMatch';
import { Property } from '../src/types';

const listing = {
  id: 'postal-regression',
  name: 'Noida Test PG',
  city: 'Noida',
  locality: '201301',
  address: 'Sector 62, Noida, Uttar Pradesh',
  placeLabel: 'Noida, Uttar Pradesh',
  pincode: undefined,
} as Property;

if (!matchesPlaceQuery(listing, '201301')) throw new Error('pincode locality search failed');
if (!matchesPlaceQuery(listing, '201301, Noida')) throw new Error('formatted pincode search failed');
if (matchesPlaceQuery(listing, '201302')) throw new Error('nearby pincode matched incorrectly');
if (!matchesPlaceQuery({ ...listing, pincode: '201301', locality: 'Sector 62' }, '201301')) {
  throw new Error('pincode field search failed');
}

console.log('4 search regression checks passed');
