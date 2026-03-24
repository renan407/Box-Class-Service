import emailjs from '@emailjs/browser';

// Estas variáveis devem ser configuradas no painel do EmailJS e adicionadas às variáveis de ambiente
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

export const emailService = {
  async sendStatusUpdate(toName: string, toEmail: string, vehicle: string, status: string, time: string, date: string) {
    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      console.warn('EmailJS não configurado. Pule o envio de e-mail.');
      return;
    }

    const statusLabels: Record<string, string> = {
      confirmed: 'Confirmado',
      washing: 'Em Lavagem',
      completed: 'Concluído',
      cancelled: 'Cancelado'
    };

    const templateParams = {
      to_name: toName,
      to_email: toEmail,
      vehicle_type: vehicle,
      status: statusLabels[status] || status,
      appointment_time: time,
      appointment_date: date,
      message: `Olá ${toName}, o status do seu agendamento para o veículo ${vehicle} foi atualizado para: ${statusLabels[status] || status}.`
    };

    try {
      const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
      console.log('E-mail enviado com sucesso!', response.status, response.text);
      return response;
    } catch (error) {
      console.error('Erro ao enviar e-mail via EmailJS:', error);
      throw error;
    }
  },

  async sendNewAppointment(toName: string, toEmail: string, vehicle: string, time: string, date: string, services: string) {
    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      console.warn('EmailJS não configurado. Pule o envio de e-mail.');
      return;
    }

    const templateParams = {
      to_name: toName,
      to_email: toEmail,
      vehicle_type: vehicle,
      appointment_time: time,
      appointment_date: date,
      services_list: services,
      message: `Olá ${toName}, seu novo agendamento para o veículo ${vehicle} foi recebido para o dia ${date} às ${time}.`
    };

    try {
      const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
      console.log('E-mail de novo agendamento enviado!', response.status, response.text);
      return response;
    } catch (error) {
      console.error('Erro ao enviar e-mail de novo agendamento:', error);
      throw error;
    }
  }
};
