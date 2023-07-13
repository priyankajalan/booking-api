import { Request, Response, NextFunction } from 'express';
import moment, { Moment } from 'moment';
import prisma from '../prisma'

interface Booking {
    guestName: string;
    unitID: string;
    checkInDate: Date;
    numberOfNights: number;
}

const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
    return res.status(200).json({
        message: "OK"
    })
}

const createBooking = async (req: Request, res: Response, next: NextFunction) => {
    const booking: Booking = req.body;

    let outcome = await isBookingPossible(booking);
    if (!outcome.result) {
        return res.status(400).json(outcome.reason);
    }

    let bookingResult = await prisma.booking.create({
        data: {
             guestName: booking.guestName,
             unitID: booking.unitID,
             checkInDate: new Date(booking.checkInDate),
             numberOfNights: booking.numberOfNights
       }
    })

    return res.status(200).json(bookingResult);
}

type bookingOutcome = {result:boolean, reason:string};

async function isBookingPossible(booking: Booking): Promise<bookingOutcome> {
    // check 1 : The Same guest cannot book the same unit multiple times
    let sameGuestSameUnit = await prisma.booking.findMany({
        where: {
            AND: {
                guestName: {
                    equals: booking.guestName,
                },
                unitID: {
                    equals: booking.unitID,
                },
            },
        },
    });
    if (sameGuestSameUnit.length > 0) {
        return {result: false, reason: "The given guest name cannot book the same unit multiple times"};
    }

    // check 2 : the same guest cannot be in multiple units at the same time
    let sameGuestAlreadyBooked = await prisma.booking.findMany({
        where: {
            guestName: {
                equals: booking.guestName,
            },
        },
    });
    if (sameGuestAlreadyBooked.length > 0) {
        return {result: false, reason: "The same guest cannot be in multiple units at the same time"};
    }

    // check 3 : Unit is available for the check-in date
    const isBookingFound = await prisma.booking.findMany({
        where: {
            // AND: {
            //     checkInDate: {
            //         equals: new Date(booking.checkInDate),
            //     },
                unitID: {
                    equals: booking.unitID,
                }
            // }
        }
    });
    if (isBookingFound.length > 0) {
        // if any existing booking is found for that unit
        const isUnitAvailableOnCheckInDate = isBookingFound.find((bookingInfo:any) => {
            const startDate: Moment = moment(bookingInfo.checkInDate) // check-in date of the existing booking
            const endDate: Moment = moment(new Date(booking.checkInDate)) // check-in date of new booking
            // duration difference of both bookings as no of days
            const days = moment.duration(endDate.diff(startDate)).asDays(); 
            // check if existing booking days clashes with the new booking
            if(days <= bookingInfo.numberOfNights){
                return true;
            }
        })
        if(isUnitAvailableOnCheckInDate){
            return {result: false, reason: "For the given check-in date, the unit is already occupied"};
        }
    }

    return {result: true, reason: "OK"};
}

export default { healthCheck, createBooking }
