import express from 'express';

interface Request extends express.Request {
    query: {
        leadId: any;
        engagementID: string;
        emailAddress: string;
        password: string;
    };
    user: {
    id: string;
    email: string;
    name: string;
    phoneNumber: string;
    companyName: string;
    companyLogo:string
    }
    lead: {
        id: string;
        name: string;
        email: string;
        phone: string;
        status: string;
        category: string;
        notes?: string;
        createdAt: Date;
    }
}


export { Request };