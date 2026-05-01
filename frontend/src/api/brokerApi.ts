
import { apiFetch } from "../utils/api";

export interface Broker {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  broker_type: 'PURCHASE' | 'SALES' | 'BOTH';
  commission_rate: number;
  status: string;
}

export interface BrokerSummary {
  id: number;
  name: string;
  broker_type: string;
  default_rate: number;
  total_earned: number;
  total_paid: number;
}

export const fetchBrokers = () => apiFetch("/brokers").then(r => r.json());

export const createBroker = (data: Partial<Broker>) => 
  apiFetch("/brokers", {
    method: "POST",
    body: JSON.stringify(data)
  }).then(r => r.json());

export const fetchBrokerSummary = () => apiFetch("/brokers/summary").then(r => r.json());

export const fetchBrokerLedger = (brokerId: number) => apiFetch(`/brokers/ledger/${brokerId}`).then(r => r.json());

export const recordBrokerPayment = (data: { broker_id: number; amount: number; payment_date: string; bank_account_id?: number }) =>
  apiFetch("/brokers/payment", {
    method: "POST",
    body: JSON.stringify(data)
  }).then(r => r.json());

export interface BrokerProductRate {
  id: number;
  product_id: number;
  product_name: string;
  commission_percentage: number;
}

export const fetchBrokerProductRates = (brokerId: number) => 
  apiFetch(`/brokers/${brokerId}/rates`).then(r => r.json());

export const setBrokerProductRate = (brokerId: number, product_id: number, percentage: number) => 
  apiFetch(`/brokers/${brokerId}/rates`, {
    method: "POST",
    body: JSON.stringify({ product_id, percentage })
  }).then(r => r.json());

export const removeBrokerProductRate = (rateId: number) => 
  apiFetch(`/brokers/rates/${rateId}`, {
    method: "DELETE"
  }).then(r => r.json());
