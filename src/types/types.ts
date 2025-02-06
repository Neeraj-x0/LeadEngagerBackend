import express from 'express';

interface Request extends express.Request {
    query: {
        emailAddress: string;
        password: string;
    };
    user: {
    _id: string;
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